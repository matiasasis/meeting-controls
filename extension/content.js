(() => {
  if (globalThis.localMeetingControlsLoaded) return;
  globalThis.localMeetingControlsLoaded = true;
  let running = true;
  let busy = false;

  function report() {
    if (!running) return;
    try {
      chrome.runtime.sendMessage({type: 'state', ...meetControls.state(document), focused: document.hasFocus()})
        .catch(() => { running = false; });
    } catch { running = false; }
  }

  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message.type === 'read') {
      respond({...meetControls.state(document), focused: document.hasFocus()});
      return;
    }
    if (message.type !== 'toggle') return;
    if (busy) { respond({error: 'A change is already pending'}); return; }
    busy = true;
    meetControls.toggle(document, message.kind, message.expected)
      .then(state => respond({state}))
      .catch(error => respond({error: error.message}))
      .finally(() => { busy = false; report(); });
    return true;
  });

  window.addEventListener('focus', report);
  window.addEventListener('blur', report);
  document.addEventListener('visibilitychange', report);
  setInterval(report, 1000);
  report();
})();
