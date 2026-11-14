export const toggles = ['mic', 'camera', 'hand', 'captions'];
export const reactions = {thumbsup: '👍', heart: '❤️', laugh: '😂', celebrate: '🎉', clap: '👏'};
export const actionNames = {
  mic: 'Microphone', camera: 'Camera', hand: 'Raise Hand', share: 'Share Screen', captions: 'Captions',
  thumbsup: 'Thumbs Up', heart: 'Heart', laugh: 'Laugh', celebrate: 'Celebrate', clap: 'Clap',
  focus: 'Show Call', status: 'Call Status', reactions: 'More Reactions', home: 'Back', leave: 'Hold to Leave',
  meeting: 'Meeting Mode'
};

export function available(kind, target) {
  if (['meeting', 'home'].includes(kind)) return true;
  if (!target) return false;
  if (['status', 'focus'].includes(kind)) return true;
  if (toggles.includes(kind)) return ['on', 'off'].includes(target[kind]);
  return target.app === 'Meet' && target.capabilities?.includes(kind);
}

export class HeldKeys {
  constructor(clock = Date.now) { this.clock = clock; this.keys = new Map(); }
  down(context, target) { this.keys.set(context, {time: this.clock(), target}); }
  up(context, target) {
    const press = this.keys.get(context);
    this.keys.delete(context);
    return !!press && press.target === target && this.clock() - press.time >= 800;
  }
  remove(context) { this.keys.delete(context); }
}
