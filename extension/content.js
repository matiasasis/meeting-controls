(() => {
  globalThis.stopMeetingControls?.();
  let running = true;
  let busy = false;

  function report() {
    if (!running) return;
    try {
      chrome.runtime.sendMessage({type: 'state', ...meetControls.state(document), focused: document.hasFocus()})
        .catch(() => { running = false; });
    } catch { running = false; }
  }

  const listener = (message, sender, respond) => {
    if (message.type === 'read') {
      respond({...meetControls.state(document), focused: document.hasFocus()});
      return;
    }
    if (!['toggle', 'perform'].includes(message.type)) return;
    if (busy) { respond({error: 'A change is already pending'}); return; }
    busy = true;
    const command = message.type === 'toggle' ? meetControls.toggle(document, message.kind, message.expected) : meetControls.perform(document, message.kind);
    command
      .then(state => respond({state}))
      .catch(error => respond({error: error.message}))
      .finally(() => { busy = false; report(); });
    return true;
  };
  chrome.runtime.onMessage.addListener(listener);

  window.addEventListener('focus', report);
  window.addEventListener('blur', report);
  document.addEventListener('visibilitychange', report);
  const interval = setInterval(report, 1000);
  globalThis.stopMeetingControls = () => {
    running = false;
    clearInterval(interval);
    window.removeEventListener('focus', report);
    window.removeEventListener('blur', report);
    document.removeEventListener('visibilitychange', report);
    try { chrome.runtime.onMessage.removeListener(listener); } catch {}
  };
  report();
})();
