import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {WebSocket} from 'ws';
import {MeetingRegistry} from './registry.js';
import {BrowserBridge} from './bridge.js';
import {SlackAdapter} from './slack.js';
import {buttonImage} from './icons.js';
import {MeetingNavigation} from './navigation.js';
import {actionNames, available, toggles, HeldKeys} from './actions.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(Array.from({length: Math.floor((process.argv.length - 2) / 2)}, (_, index) => process.argv.slice(2 + index * 2, 4 + index * 2)));
const configuration = JSON.parse(readFileSync(path.join(root, '../local-config.json')));
const registry = new MeetingRegistry();
const bridge = new BrowserBridge(configuration.token, registry);
const slack = new SlackAdapter(configuration.helper);
const deck = new WebSocket(`ws://127.0.0.1:${args['-port']}`);
const keys = new Map();
const held = new HeldKeys();
const navigation = new MeetingNavigation((device, payload) => send('switchToProfile', args['-pluginUUID'], payload, device));
let busy = false;
let slackPolling = false;

function send(event, context, payload, device) {
  if (deck.readyState === WebSocket.OPEN) deck.send(JSON.stringify({event, context, payload, device}));
}

function render() {
  const target = registry.target();
  navigation.update(!!target);
  for (const [context, key] of keys) {
    const image = buttonImage(key.kind, target, busy && !['home', 'meeting'].includes(key.kind));
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

async function perform(context, kind) {
  const target = registry.target();
  if (busy || !available(kind, target)) { send('showAlert', context); return; }
  busy = true;
  render();
  try {
    const adapter = target.app === 'Meet' ? bridge : slack;
    const state = toggles.includes(kind) ? await adapter.toggle(target, kind) : await adapter.perform(target, kind);
    if (toggles.includes(kind) && (!state || !['on', 'off'].includes(state[kind]) || state[kind] === target[kind])) {
      throw new Error('State was not confirmed');
    }
    if (state) registry.update(target.id, {...target, ...state});
  } catch (error) {
    console.error(error.message);
    send('showAlert', context);
  } finally { busy = false; render(); }
}

function appear(event, kind) {
  keys.set(event.context, {kind, device: event.device});
  if (kind === 'meeting') navigation.register(event.device);
  if (kind === 'home') { navigation.register(event.device, true); navigation.visible(event.device, true); }
  render();
}

function press(event, kind) {
  if (kind === 'home') { navigation.home(event.device); return; }
  if (kind === 'meeting') { navigation.register(event.device); navigation.open(event.device); return; }
  if (kind === 'leave') { held.down(event.context, registry.target()?.id); return; }
  void perform(event.context, kind === 'status' ? 'focus' : kind);
}

function receive(event) {
  const kind = event.action?.split('.').at(-1);
  if (!Object.hasOwn(actionNames, kind)) return;
  if (event.event === 'sendToPlugin' && ['meeting', 'home'].includes(kind)) {
    const device = keys.get(event.context)?.device;
    if (event.payload?.navigate === 'meeting') navigation.open(device);
    if (event.payload?.navigate === 'home') navigation.home(device);
    return;
  }
  if (event.event === 'willAppear') appear(event, kind);
  if (event.event === 'willDisappear') {
    if (kind === 'home') navigation.visible(event.device, false);
    keys.delete(event.context);
    held.remove(event.context);
  }
  if (event.event === 'keyDown') press(event, kind);
  if (event.event === 'keyUp' && kind === 'leave' && held.up(event.context, registry.target()?.id)) void perform(event.context, kind);
}

deck.on('open', () => deck.send(JSON.stringify({event: args['-registerEvent'], uuid: args['-pluginUUID']})));
deck.on('message', bytes => {
  let event;
  try { event = JSON.parse(bytes); } catch { return; }
  receive(event);
});
deck.on('error', error => console.error(error.message));
deck.on('close', () => process.exit(0));
bridge.on('change', render);
bridge.listen(configuration.bridgePort ?? 18765).catch(error => console.error(`Browser bridge unavailable: ${error.message}`));
setInterval(pollSlack, 2000);
setInterval(render, 1000);
void pollSlack();
