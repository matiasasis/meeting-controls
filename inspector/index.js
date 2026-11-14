globalThis.connectElgatoStreamDeckSocket = (port, uuid, registerEvent, info, actionInfo) => {
  const action = JSON.parse(actionInfo);
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);
  socket.onopen = () => {
    socket.send(JSON.stringify({event: registerEvent, uuid}));
    document.querySelector('#status').textContent = 'Available for 15-key Stream Decks.';
    for (const button of document.querySelectorAll('button')) {
      button.disabled = false;
      button.onclick = () => {
        socket.send(JSON.stringify({event: 'sendToPlugin', action: action.action,
          context: uuid, payload: {navigate: button.id}}));
        document.querySelector('#status').textContent = 'Requested ' + button.textContent + '.';
      };
    }
  };
  socket.onclose = () => {
    for (const button of document.querySelectorAll('button')) button.disabled = true;
    document.querySelector('#status').textContent = 'Reconnect by selecting this key again.';
  };
};
