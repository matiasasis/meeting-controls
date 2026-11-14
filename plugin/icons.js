import {available, reactions} from './actions.js';

const glyphs = {hand: '✋', share: '↥', captions: 'CC', focus: '▣', status: '●', reactions: '☺', home: '⌂', leave: '☎', meeting: '▦', ...reactions};
const labels = {hand: 'HAND', share: 'SHARE', captions: 'CAPTIONS', focus: 'SHOW CALL', status: 'CALL', reactions: 'REACTIONS', home: 'HOME', leave: 'HOLD 0.8s', meeting: 'MEETING'};

export function buttonImage(kind, meeting, busy = false) {
  const state = meeting?.[kind] ?? 'unknown';
  const enabled = available(kind, meeting);
  const color = busy ? '#a96b11' : !enabled ? '#424754' : kind === 'leave' ? '#b53347'
    : state === 'on' ? '#087c68' : state === 'off' ? '#b53347' : '#493ed8';
  let glyph;
  if (kind === 'mic') glyph = '<g fill="none" stroke="white" stroke-width="6" stroke-linecap="round"><rect x="58" y="38" width="28" height="44" rx="14"/><path d="M48 65v5a24 24 0 0 0 48 0v-5M72 94v15M59 109h26"/></g>';
  else if (kind === 'camera') glyph = '<g fill="none" stroke="white" stroke-width="6" stroke-linejoin="round"><rect x="36" y="48" width="52" height="44" rx="8"/><path d="m88 59 22-11v44L88 81z"/></g>';
  else glyph = `<text x="72" y="92" text-anchor="middle" fill="white" font-family="Arial, Apple Color Emoji" font-size="64">${glyphs[kind] ?? '?'}</text>`;
  const slash = state === 'off' && ['mic', 'camera'].includes(kind) ? `<path d="m37 36 70 70" stroke="${color}" stroke-width="13"/><path d="m37 36 70 70" stroke="white" stroke-width="6"/>` : '';
  const label = busy ? 'WAIT' : labels[kind] ?? (meeting ? meeting.app.toUpperCase() : 'NO CALL');
  const app = ['home', 'meeting'].includes(kind) ? '' : meeting?.app.toUpperCase() ?? '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144"><rect width="144" height="144" rx="20" fill="${color}"/><text x="72" y="21" fill="#ffffff" text-anchor="middle" font-family="Arial" font-size="14">${app}</text>${glyph}${slash}<text x="72" y="132" fill="white" text-anchor="middle" font-family="Arial" font-size="17" font-weight="bold">${label}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
