globalThis.meetControls = (() => {
  const labels = {
    mic: {on: /^Turn off microphone(?:\s*\(.*\))?$/i, off: /^Turn on microphone(?:\s*\(.*\))?$/i},
    camera: {on: /^Turn off camera(?:\s*\(.*\))?$/i, off: /^Turn on camera(?:\s*\(.*\))?$/i},
    hand: {on: /^Lower (?:your )?hand(?:\s*\(.*\))?$/i, off: /^Raise (?:your )?hand(?:\s*\(.*\))?$/i},
    captions: {on: /^Turn off captions(?:\s*\(.*\))?$/i, off: /^Turn on captions(?:\s*\(.*\))?$/i}
  };
  const reactionLabels = {
    thumbsup: /^(?:👍[🏻🏼🏽🏾🏿]?|Thumbs up)(?: reaction)?$/iu,
    heart: /^(?:❤️?|Red heart|Heart)(?: reaction)?$/iu,
    laugh: /^(?:😂|Face with tears of joy|Laugh)(?: reaction)?$/iu,
    celebrate: /^(?:🎉|Party popper|Celebrate)(?: reaction)?$/iu,
    clap: /^(?:👏[🏻🏼🏽🏾🏿]?|Clapping hands|Clap)(?: reaction)?$/iu
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
      if (kind === 'captions' && /^Captions(?: and translation)?$/i.test(label(button))) {
        const pressed = button.getAttribute('aria-pressed');
        if (['true', 'false'].includes(pressed)) return [{button, state: pressed === 'true' ? 'on' : 'off'}];
      }
      return [];
    });
    return matches.length === 1 ? matches[0] : null;
  }

  function state(root) {
    const active = buttons(root).some(button => /^Leave call(?:\s*\(.*\))?$/i.test(label(button)));
    const capabilities = [];
    if (active) {
      capabilities.push('focus', 'leave');
      if (find(root, /^Present now(?:\s*\(.*\))?$/i)) capabilities.push('share');
      if (find(root, /^Send a reaction$/i)) capabilities.push('reactions', ...Object.keys(reactionLabels));
    }
    return {active, ...Object.fromEntries(Object.keys(labels).map(kind => [kind, active ? control(root, kind)?.state ?? 'unknown' : 'unknown'])), capabilities};
  }

  function find(root, pattern) {
    const matches = buttons(root).filter(button => !button.disabled && button.getAttribute('aria-disabled') !== 'true' && pattern.test(label(button)));
    return matches.length === 1 ? matches[0] : null;
  }

  async function reaction(root, kind) {
    let button = find(root, reactionLabels[kind]);
    if (!button) {
      const menu = find(root, /^Send a reaction$/i);
      if (!menu) throw new Error('Reactions are unavailable');
      menu.click();
      for (let attempt = 0; attempt < 10 && !button; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!state(root).active) throw new Error('Meeting ended');
        button = find(root, reactionLabels[kind]);
      }
    }
    if (!button) throw new Error('Requested reaction is unavailable');
    button.click();
    return state(root);
  }

  async function perform(root, kind) {
    if (!state(root).active) throw new Error('Meeting ended');
    if (Object.hasOwn(reactionLabels, kind)) return reaction(root, kind);
    const patterns = {share: /^Present now(?:\s*\(.*\))?$/i, reactions: /^Send a reaction$/i, leave: /^Leave call(?:\s*\(.*\))?$/i};
    if (!patterns[kind]) throw new Error('Unsupported meeting action');
    const button = find(root, patterns[kind]);
    if (!button) throw new Error('Meeting action is unavailable');
    button.click();
    if (kind === 'leave') {
      for (let attempt = 0; attempt < 15; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!state(root).active) return state(root);
      }
      throw new Error('Complete the leave confirmation in Meet');
    }
    return state(root);
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

  return {state, toggle, perform};
})();
