import http from 'node:http';
import {timingSafeEqual, randomUUID} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {WebSocketServer, WebSocket} from 'ws';

export class BrowserBridge extends EventEmitter {
  constructor(token, registry) {
    super();
    this.token = token;
    this.registry = registry;
    this.pending = new Map();
    this.server = http.createServer((request, response) => { response.writeHead(404); response.end(); });
    this.websocket = new WebSocketServer({noServer: true, maxPayload: 8192});
    this.server.on('upgrade', (request, socket, head) => {
      if (!/^chrome-extension:\/\/[a-p]{32}$/.test(request.headers.origin ?? '')) { socket.destroy(); return; }
      this.websocket.handleUpgrade(request, socket, head, client => this.accept(client));
    });
    this.heartbeat = setInterval(() => {
      if (this.client?.readyState === WebSocket.OPEN) this.client.send(JSON.stringify({type: 'ping'}));
    }, 20000);
  }

  listen(port = 18765) {
    return new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(port, '127.0.0.1', resolve);
    });
  }

  accept(client) {
    let authenticated = false;
    const timeout = setTimeout(() => client.close(), 2000);
    client.on('error', () => {});
    client.on('message', bytes => {
      let message;
      try { message = JSON.parse(bytes); } catch { client.close(); return; }
      if (!authenticated) {
        const provided = Buffer.from(typeof message.token === 'string' ? message.token : '');
        const expected = Buffer.from(this.token);
        if (message.type !== 'authenticate' || provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
          client.close(); return;
        }
        authenticated = true;
        clearTimeout(timeout);
        this.registry.removeBrowser();
        this.client?.close();
        this.client = client;
        return;
      }
      if (client !== this.client) return;
      this.receive(message);
    });
    client.on('close', () => {
      clearTimeout(timeout);
      if (this.client !== client) return;
      this.client = null;
      this.registry.removeBrowser();
      for (const pending of this.pending.values()) pending.reject(new Error('Browser disconnected'));
      this.pending.clear();
      this.emit('change');
    });
  }

  receive(message) {
    if (message.type === 'state' && Number.isInteger(message.tabId)) {
      this.registry.update(`meet:${message.tabId}`, {app: 'Meet', active: message.active === true,
        focused: message.focused === true, mic: this.state(message.mic), camera: this.state(message.camera)});
    } else if (message.type === 'remove' && Number.isInteger(message.tabId)) {
      this.registry.remove(`meet:${message.tabId}`);
    } else if (message.type === 'result') {
      const pending = this.pending.get(message.id);
      if (pending) {
        this.pending.delete(message.id);
        message.error ? pending.reject(new Error(message.error)) : pending.resolve(message.state);
      }
    }
    this.emit('change');
  }

  state(value) { return ['on', 'off'].includes(value) ? value : 'unknown'; }

  toggle(target, kind) {
    if (this.client?.readyState !== WebSocket.OPEN) return Promise.reject(new Error('Browser disconnected'));
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error('Browser response timed out')); }, 2500);
      this.pending.set(id, {
        resolve: state => { clearTimeout(timeout); resolve(state); },
        reject: error => { clearTimeout(timeout); reject(error); }
      });
      this.client.send(JSON.stringify({type: 'toggle', id, tabId: Number(target.id.split(':')[1]), kind, expected: target[kind]}));
    });
  }

  close() {
    clearInterval(this.heartbeat);
    for (const client of this.websocket.clients) client.terminate();
    this.websocket.close();
    this.server.close();
  }
}
