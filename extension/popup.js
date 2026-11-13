async function refresh() {
  const status = await chrome.runtime.sendMessage({type: 'connection-status'});
  document.querySelector('#connection').textContent = status.connected ? 'Connected to Stream Deck' : 'Stream Deck plugin is disconnected';
  document.querySelector('#calls').textContent = status.calls.length
    ? status.calls.map(call => `Meet — mic ${call.mic}, camera ${call.camera}`).join('\n')
    : 'No active Meet call detected. Reload an existing Meet tab after installing.';
}
void refresh();
setInterval(refresh, 1000);
