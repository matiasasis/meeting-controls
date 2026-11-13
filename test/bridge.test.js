import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {BrowserBridge} from '../plugin/bridge.js';
import {MeetingRegistry} from '../plugin/registry.js';

const origin = `chrome-extension://${'a'.repeat(32)}`;
const pause = () => new Promise(resolve => setTimeout(resolve, 30));

test('rejects website origins and wrong credentials', async t => {
  const registry = new MeetingRegistry();
  const bridge = new BrowserBridge('test-token', registry);
  t.after(() => bridge.close());
  await bridge.listen(0);
  const url = `ws://127.0.0.1:${bridge.server.address().port}`;
  const website = new WebSocket(url, {origin: 'https://meet.google.com'});
  await once(website, 'error');
  const client = new WebSocket(url, {origin});
  await once(client, 'open');
  client.send(JSON.stringify({type: 'authenticate', token: 'wrong-token'}));
  await once(client, 'close');
  assert.equal(registry.target(), null);
});

test('routes to a specific tab once and clears stale state on disconnect', async t => {
  const registry = new MeetingRegistry();
  const bridge = new BrowserBridge('test-token', registry);
  t.after(() => bridge.close());
  await bridge.listen(0);
  const client = new WebSocket(`ws://127.0.0.1:${bridge.server.address().port}`, {origin});
  await once(client, 'open');
  client.send(JSON.stringify({type: 'authenticate', token: 'test-token'}));
  client.send(JSON.stringify({type: 'state', tabId: 42, active: true, focused: true, mic: 'off', camera: 'on'}));
  await pause();
  const received = once(client, 'message');
  const pending = bridge.toggle(registry.target(), 'mic');
  const message = JSON.parse((await received)[0]);
  assert.equal(message.tabId, 42);
  assert.equal(message.expected, 'off');
  client.send(JSON.stringify({type: 'result', id: message.id, state: {mic: 'on'}}));
  assert.equal((await pending).mic, 'on');
  client.close();
  await once(client, 'close');
  await pause();
  assert.equal(registry.target(), null);
});
