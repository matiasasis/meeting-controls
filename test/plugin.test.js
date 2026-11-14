import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdtempSync, cpSync, symlinkSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {WebSocketServer, WebSocket} from 'ws';

function nextMessage(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.off('message', listener); reject(new Error('Message timed out')); }, 5000);
    const listener = bytes => {
      const message = JSON.parse(bytes);
      if (!predicate(message)) return;
      clearTimeout(timeout);
      socket.off('message', listener);
      resolve(message);
    };
    socket.on('message', listener);
  });
}

test('plugin registers, renders live state, and routes a Stream Deck press to Meet', async t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'meeting-plugin-test-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  cpSync('plugin', path.join(directory, 'plugin'), {recursive: true});
  symlinkSync(path.resolve('node_modules'), path.join(directory, 'node_modules'));
  writeFileSync(path.join(directory, 'package.json'), '{"type":"module"}');
  const reservation = net.createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const bridgePort = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  writeFileSync(path.join(directory, 'local-config.json'), JSON.stringify({token: 'integration-token', helper: '/usr/bin/false', bridgePort}));
  const server = new WebSocketServer({port: 0, host: '127.0.0.1'});
  t.after(() => { for (const client of server.clients) client.terminate(); server.close(); });
  await once(server, 'listening');
  const connection = once(server, 'connection');
  const child = spawn(process.execPath, [path.join(directory, 'plugin/main.js'), '-port', String(server.address().port),
    '-pluginUUID', 'test', '-registerEvent', 'registerPlugin']);
  t.after(() => child.kill());
  const [deck] = await connection;
  const registration = await nextMessage(deck, message => message.event === 'registerPlugin');
  assert.equal(registration.uuid, 'test');
  const firstImage = nextMessage(deck, message => message.event === 'setImage');
  deck.send(JSON.stringify({event: 'willAppear', context: 'key', action: 'com.mati.meetingcontrols.mic'}));
  assert.match((await firstImage).payload.image, /^data:image\/svg\+xml;base64,/);
  const browser = new WebSocket(`ws://127.0.0.1:${bridgePort}`, {origin: `chrome-extension://${'a'.repeat(32)}`});
  t.after(() => browser.terminate());
  await once(browser, 'open');
  const stateImage = nextMessage(deck, message => message.event === 'setImage');
  browser.send(JSON.stringify({type: 'authenticate', token: 'integration-token'}));
  browser.send(JSON.stringify({type: 'state', tabId: 7, active: true, mic: 'off', camera: 'off', focused: true}));
  assert.match(Buffer.from((await stateImage).payload.image.split(',')[1], 'base64').toString(), /MEET/);
  const command = nextMessage(browser, message => message.type === 'toggle');
  deck.send(JSON.stringify({event: 'keyDown', context: 'key', action: 'com.mati.meetingcontrols.mic'}));
  const message = await command;
  assert.equal(message.tabId, 7);
  assert.equal(message.kind, 'mic');
  assert.equal(message.expected, 'off');
  const finalImage = nextMessage(deck, event => event.event === 'setImage' &&
    Buffer.from(event.payload.image.split(',')[1], 'base64').toString().includes('#087c68'));
  browser.send(JSON.stringify({type: 'result', id: message.id, state: {active: true, mic: 'on', camera: 'off'}}));
  await finalImage;
  const automatic = nextMessage(deck, event => event.event === 'switchToProfile');
  deck.send(JSON.stringify({event: 'willAppear', device: 'deck', context: 'launcher', action: 'com.mati.meetingcontrols.meeting'}));
  assert.equal((await automatic).payload.profile, 'profiles/Meeting Mode');
  deck.send(JSON.stringify({event: 'willAppear', device: 'deck', context: 'homekey', action: 'com.mati.meetingcontrols.home'}));
  const home = nextMessage(deck, event => event.event === 'switchToProfile');
  deck.send(JSON.stringify({event: 'sendToPlugin', context: 'launcher', action: 'com.mati.meetingcontrols.meeting', payload: {navigate: 'home'}}));
  assert.deepEqual((await home).payload, {});
  const reopen = nextMessage(deck, event => event.event === 'switchToProfile');
  deck.send(JSON.stringify({event: 'sendToPlugin', context: 'launcher', action: 'com.mati.meetingcontrols.meeting', payload: {navigate: 'meeting'}}));
  assert.equal((await reopen).device, 'deck');
});
