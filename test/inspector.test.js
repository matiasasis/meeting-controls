import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

test('inspector routes navigation using its registration context and disables on disconnect', () => {
  const dom = new JSDOM(readFileSync(new URL('../inspector/index.html', import.meta.url), 'utf8'), {runScripts: 'outside-only'});
  const messages = [];
  let socket;
  dom.window.WebSocket = class {
    constructor() { socket = this; }
    send(message) { messages.push(JSON.parse(message)); }
  };
  dom.window.eval(readFileSync(new URL('../inspector/index.js', import.meta.url), 'utf8'));
  dom.window.connectElgatoStreamDeckSocket(1234, 'key-context', 'registerPropertyInspector', '{}', JSON.stringify({action: 'com.mati.meetingcontrols.meeting'}));
  socket.onopen();
  dom.window.document.querySelector('#meeting').click();
  assert.equal(messages[1].context, 'key-context');
  assert.deepEqual(messages[1].payload, {navigate: 'meeting'});
  socket.onclose();
  dom.window.document.querySelector('#home').click();
  assert.equal(messages.length, 2);
  dom.window.close();
});
