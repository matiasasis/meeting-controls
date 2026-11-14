import {token} from './config.js';

let socket;
const states = new Map();
let polling = false;

function record(tabId, state) {
  states.set(tabId, {state, received: Date.now()});
  send({type: 'state', tabId, ...state});
}

async function pollTabs() {
  if (polling || socket?.readyState !== WebSocket.OPEN) return;
  polling = true;
  try {
    const tabs = await chrome.tabs.query({url: 'https://meet.google.com/*'});
    await Promise.all(tabs.map(async tab => {
      try { record(tab.id, await chrome.tabs.sendMessage(tab.id, {type: 'read'})); }
      catch { states.delete(tab.id); send({type: 'remove', tabId: tab.id}); }
    }));
  } finally { polling = false; }
}

function send(message) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function connect() {
  if (socket && socket.readyState < WebSocket.CLOSING) return;
  socket = new WebSocket('ws://127.0.0.1:18765');
  socket.onopen = () => {
    send({type: 'authenticate', token});
    void pollTabs();
    for (const [tabId, entry] of states) {
      if (Date.now() - entry.received < 5000) send({...entry.state, type: 'state', tabId});
    }
  };
  socket.onmessage = async event => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === 'ping') { send({type: 'pong'}); return; }
    if (!['toggle', 'perform'].includes(message.type) || !Number.isInteger(message.tabId)) return;
    try {
      const current = await chrome.tabs.get(message.tabId);
      if (!current.url?.startsWith('https://meet.google.com/')) throw new Error('Not a Meet tab');
      if (['focus', 'share', 'reactions', 'leave'].includes(message.kind)) {
        await chrome.tabs.update(message.tabId, {active: true});
        await chrome.windows.update(current.windowId, {focused: true});
      }
      if (message.kind === 'focus') {
        send({type: 'result', id: message.id, state: await chrome.tabs.sendMessage(message.tabId, {type: 'read'})});
        return;
      }
      const result = await chrome.tabs.sendMessage(message.tabId, message);
      send({type: 'result', id: message.id, ...result});
    } catch { send({type: 'result', id: message.id, error: 'Meet tab is no longer available'}); }
  };
  socket.onclose = () => setTimeout(connect, 2000);
  socket.onerror = () => socket.close();
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type !== 'state' || !sender.tab || !sender.url?.startsWith('https://meet.google.com/')) return;
  const state = {active: message.active === true, focused: message.focused === true,
    mic: message.mic, camera: message.camera, hand: message.hand, captions: message.captions, capabilities: message.capabilities};
  record(sender.tab.id, state);
  respond({ok: true});
  connect();
});

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type !== 'connection-status' || sender.tab) return;
  respond({connected: socket?.readyState === WebSocket.OPEN,
    calls: [...states.values()].filter(entry => Date.now() - entry.received < 5000 && entry.state.active).map(entry => entry.state)});
});

chrome.tabs.onRemoved.addListener(tabId => {
  states.delete(tabId);
  send({type: 'remove', tabId});
});
chrome.alarms.create('reconnect', {periodInMinutes: 0.5});
chrome.alarms.onAlarm.addListener(connect);
chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({url: 'https://meet.google.com/*'});
  for (const tab of tabs) {
    try { await chrome.scripting.executeScript({target: {tabId: tab.id}, files: ['meet-controls.js', 'content.js']}); }
    catch { /* A closing tab will reconnect on its next visit. */ }
  }
});
setInterval(pollTabs, 2000);
connect();
