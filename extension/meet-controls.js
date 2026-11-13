globalThis.meetControls = (() => {
  const labels = {
    mic: {on: /^Turn off microphone(?:\s*\(.*\))?$/i, off: /^Turn on microphone(?:\s*\(.*\))?$/i},
    camera: {on: /^Turn off camera(?:\s*\(.*\))?$/i, off: /^Turn on camera(?:\s*\(.*\))?$/i}
  };

  function visible(element) {
    return !element.closest('[hidden], [aria-hidden="true"]') && element.getClientRects().length > 0;
  }

  function buttons(root) {
    return [...root.querySelectorAll('button, [role="button"]')].filter(visible);
  }

  function label(button) {
    return (button.getAttribute('aria-label') || button.textContent || '').trim();
  }

  function control(root, kind) {
    if (!labels[kind]) return null;
    const matches = buttons(root).flatMap(button => {
      if (button.disabled || button.getAttribute('aria-disabled') === 'true') return [];
      for (const [state, pattern] of Object.entries(labels[kind])) {
        if (pattern.test(label(button))) return [{button, state}];
      }
      return [];
    });
    return matches.length === 1 ? matches[0] : null;
  }

  function state(root) {
    const active = buttons(root).some(button => /^Leave call(?:\s*\(.*\))?$/i.test(label(button)));
    return {active, mic: active ? control(root, 'mic')?.state ?? 'unknown' : 'unknown',
      camera: active ? control(root, 'camera')?.state ?? 'unknown' : 'unknown'};
  }

  async function toggle(root, kind, expected) {
    const before = state(root);
    const target = control(root, kind);
    if (!before.active || !target || target.state !== expected) throw new Error('Meeting control changed or is unavailable');
    target.button.click();
    for (let attempt = 0; attempt < 15; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const after = state(root);
      if (!after.active) throw new Error('Meeting ended');
      if (after[kind] !== expected && ['on', 'off'].includes(after[kind])) return after;
    }
    throw new Error('Meet did not confirm the change');
  }

  return {state, toggle};
})();
