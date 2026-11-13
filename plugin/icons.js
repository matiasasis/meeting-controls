export function buttonImage(kind, meeting, busy = false) {
  const state = meeting?.[kind] ?? 'unknown';
  const color = busy ? '#a96b11' : state === 'on' ? '#087c68' : state === 'off' ? '#b53347' : '#424754';
  const glyph = kind === 'mic'
    ? '<rect x="58" y="38" width="28" height="44" rx="14"/><path d="M48 65v5a24 24 0 0 0 48 0v-5M72 94v15M59 109h26"/>'
    : '<rect x="36" y="48" width="52" height="44" rx="8"/><path d="m88 59 22-11v44L88 81z"/>';
  const slash = state === 'off' ? '<path d="m37 36 70 70" stroke="#b53347" stroke-width="13"/><path d="m37 36 70 70" stroke="white" stroke-width="6"/>' : '';
  const label = busy ? 'WAIT' : meeting ? meeting.app.toUpperCase() : 'NO CALL';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144"><rect width="144" height="144" rx="20" fill="${color}"/><g fill="none" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${glyph}${slash}</g><text x="72" y="132" fill="white" text-anchor="middle" font-family="Arial" font-size="18" font-weight="bold">${label}</text>${state === 'unknown' && meeting ? '<text x="115" y="36" fill="white" font-size="28">?</text>' : ''}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
