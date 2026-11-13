import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {WebSocket} from 'ws';
import {MeetingRegistry} from './registry.js';
import {BrowserBridge} from './bridge.js';
import {SlackAdapter} from './slack.js';
import {buttonImage} from './icons.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(Array.from({length: Math.floor((process.argv.length - 2) / 2)}, (_, index) => process.argv.slice(2 + index * 2, 4 + index * 2)));
const configuration = JSON.parse(readFileSync(path.join(root, '../local-config.json')));
const registry = new MeetingRegistry();
const bridge = new BrowserBridge(configuration.token, registry);
const slack = new SlackAdapter(configuration.helper);
const deck = new WebSocket(`ws://127.0.0.1:${args['-port']}`);
const keys = new Map();
let busy = false;
let slackPolling = false;

function send(event, context, payload) {
  if (deck.readyState === WebSocket.OPEN) deck.send(JSON.stringify({event, context, payload}));
}

function render() {
  const target = registry.target();
  for (const [context, key] of keys) {
    const image = buttonImage(key.kind, target, busy);
    if (key.image === image) continue;
    key.image = image;
    send('setImage', context, {image, target: 0});
    send('setTitle', context, {title: '', target: 0});
  }
}

async function pollSlack() {
  if (slackPolling || busy) return;
  slackPolling = true;
  try { registry.update('slack', {app: 'Slack', ...await slack.status()}); }
  catch { registry.remove('slack'); }
  finally { slackPolling = false; render(); }
}

async function toggle(context, kind) {
  const target = registry.target();
  if (busy || !target || !['on', 'off'].includes(target[kind])) { send('showAlert', context); return; }
  busy = true;
  render();
  try {
    const adapter = target.app === 'Meet' ? bridge : slack;
    const state = await adapter.toggle(target, kind);
    if (!state || !['on', 'off'].includes(state[kind]) || state[kind] === target[kind]) throw new Error('State was not confirmed');
    registry.update(target.id, {...target, ...state});
  } catch (error) {
    console.error(error.message);
    send('showAlert', context);
  } finally { busy = false; render(); }
}

deck.on('open', () => deck.send(JSON.stringify({event: args['-registerEvent'], uuid: args['-pluginUUID']})));
deck.on('message', bytes => {
  let event;
  try { event = JSON.parse(bytes); } catch { return; }
  const kind = event.action?.endsWith('.mic') ? 'mic' : event.action?.endsWith('.camera') ? 'camera' : null;
  if (event.event === 'willAppear' && kind) { keys.set(event.context, {kind}); render(); }
  if (event.event === 'willDisappear') keys.delete(event.context);
  if (event.event === 'keyDown' && kind) void toggle(event.context, kind);
});
deck.on('error', error => console.error(error.message));
deck.on('close', () => process.exit(0));
bridge.on('change', render);
bridge.listen().catch(error => console.error(`Browser bridge unavailable: ${error.message}`));
setInterval(pollSlack, 2000);
setInterval(render, 1000);
void pollSlack();
