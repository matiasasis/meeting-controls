import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('service worker authenticates, polls background tabs, and returns command results', async () => {
  let socket;
  const handlers = {};
  const outgoing = [];
  const requests = [];
  class Socket {
    static OPEN = 1;
    static CLOSING = 2;
    constructor() { socket = this; this.readyState = 1; }
    send(bytes) { outgoing.push(JSON.parse(bytes)); }
  }
  const chrome = {
    tabs: {
      query: async () => [{id: 5}],
      sendMessage: async (id, message) => {
        requests.push({id, message});
        return message.type === 'read' ? {active: true, mic: 'off', camera: 'on', focused: false} : {state: {mic: 'on'}};
      },
      onRemoved: {addListener: handler => { handlers.remove = handler; }}
    },
    scripting: {executeScript: async () => {}},
    runtime: {onMessage: {addListener: () => {}}, onStartup: {addListener: () => {}}, onInstalled: {addListener: () => {}}},
    alarms: {create: () => {}, onAlarm: {addListener: () => {}}}
  };
  const source = readFileSync(new URL('../extension/background.js', import.meta.url), 'utf8').replace("import {token} from './config.js';", "const token = 'test-secret';");
  vm.runInNewContext(source, {chrome, WebSocket: Socket, setInterval: () => {}, setTimeout: () => {}, Date, Map, JSON});
  socket.onopen();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(outgoing[0].type, 'authenticate');
  assert.equal(outgoing[0].token, 'test-secret');
  assert.ok(outgoing.some(message => message.type === 'state' && message.tabId === 5 && message.mic === 'off'));
  await socket.onmessage({data: JSON.stringify({type: 'toggle', id: 'command', tabId: 5, kind: 'mic', expected: 'off'})});
  assert.equal(requests.at(-1).id, 5);
  assert.equal(outgoing.at(-1).state.mic, 'on');
  handlers.remove(5);
  assert.equal(outgoing.at(-1).type, 'remove');
});
