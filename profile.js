import {mkdirSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {actionNames} from './plugin/actions.js';

export const layout = [
  ['home', 'camera', 'hand', 'share', 'captions'],
  ['thumbsup', 'heart', 'laugh', 'celebrate', 'clap'],
  ['focus', 'status', 'reactions', 'mic', 'leave']
];

export function profileActions() {
  return Object.fromEntries(layout.flatMap((row, y) => row.map((kind, x) => [`${x},${y}`, {
    Name: actionNames[kind], UUID: `com.mati.meetingcontrols.${kind}`, Settings: {}, State: 0,
    States: [{ShowTitle: false, Title: ''}], LinkedTitle: true
  }])));
}

export function buildProfile(plugin) {
  const temporary = mkdtempSync(path.join(tmpdir(), 'meeting-profile-'));
  const folder = 'A95A3778-04B8-4E04-94F0-FE17B9103E34.sdProfile';
  const page = 'c8057c39-9ec6-46c6-8e2f-e0063b0fd48f';
  try {
    const root = path.join(temporary, folder);
    mkdirSync(path.join(root, 'Profiles', page.toUpperCase()), {recursive: true});
    writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({Device: {Model: '20GAA9902', UUID: ''},
      Name: 'Meeting Mode', InstalledByPluginUUID: 'com.mati.meetingcontrols', PreconfiguredName: 'profiles/Meeting Mode',
      Pages: {Current: page, Default: page, Pages: [page]}, Version: '3.0'}));
    writeFileSync(path.join(root, 'Profiles', page.toUpperCase(), 'manifest.json'), JSON.stringify({
      Controllers: [{Actions: profileActions(), Type: 'Keypad'}], Icon: '', Name: ''
    }));
    mkdirSync(path.join(plugin, 'profiles'), {recursive: true});
    execFileSync('/usr/bin/zip', ['-qr', path.join(plugin, 'profiles/Meeting Mode.streamDeckProfile'), folder], {cwd: temporary});
  } finally { rmSync(temporary, {recursive: true, force: true}); }
}
