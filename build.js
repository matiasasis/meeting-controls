import {cpSync, mkdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {buttonImage} from './plugin/icons.js';

const output = path.resolve('dist');
const plugin = path.join(output, 'com.mati.meetingcontrols.sdPlugin');
const helper = path.join(output, 'Meeting Controls Helper.app');
mkdirSync(plugin, {recursive: true});
mkdirSync(path.join(helper, 'Contents/MacOS'), {recursive: true});
const tokenPath = path.join(output, 'pairing-token');
const token = existsSync(tokenPath) ? readFileSync(tokenPath, 'utf8') : randomBytes(32).toString('hex');
writeFileSync(tokenPath, token, {mode: 0o600});
cpSync('extension', path.join(output, 'extension'), {recursive: true});
writeFileSync(path.join(output, 'extension/config.js'), `export const token = ${JSON.stringify(token)};\n`, {mode: 0o600});
cpSync('plugin', path.join(plugin, 'plugin'), {recursive: true});
cpSync('node_modules/ws', path.join(plugin, 'node_modules/ws'), {recursive: true});
writeFileSync(path.join(plugin, 'package.json'), JSON.stringify({type: 'module'}));
writeFileSync(path.join(plugin, 'local-config.json'), JSON.stringify({token,
  helper: path.join(os.homedir(), 'Applications/Meeting Controls Helper.app/Contents/MacOS/MeetingControlsHelper')}), {mode: 0o600});

mkdirSync(path.join(plugin, 'images'), {recursive: true});
for (const kind of ['mic', 'camera']) {
  writeFileSync(path.join(plugin, `images/${kind}.svg`), Buffer.from(buttonImage(kind, null).split(',')[1], 'base64'));
}
const actions = ['mic', 'camera'].map(kind => ({UUID: `com.mati.meetingcontrols.${kind}`,
  Name: kind === 'mic' ? 'Meeting Microphone' : 'Meeting Camera', Icon: `images/${kind}`,
  Tooltip: 'Toggle the last focused Meet call or Slack Huddle. The icon reports the actual state.',
  Controllers: ['Keypad'], UserTitleEnabled: false, States: [{Image: `images/${kind}`, ShowTitle: false}]}));
writeFileSync(path.join(plugin, 'manifest.json'), JSON.stringify({Name: 'Local Meeting Controls',
  Author: 'Matias Asis', Description: 'Local microphone and camera controls for Meet and Slack.',
  Version: '0.1.0.0', UUID: 'com.mati.meetingcontrols', SDKVersion: 2,
  CodePath: 'plugin/main.js', Nodejs: {Version: '20'}, Icon: 'images/mic',
  Category: 'Meeting Controls', CategoryIcon: 'images/mic',
  OS: [{Platform: 'mac', MinimumVersion: '12'}], Software: {MinimumVersion: '6.5'}, Actions: actions}, null, 2));

const sdk = process.env.SWIFT_SDK ?? execFileSync('xcrun', ['--show-sdk-path'], {encoding: 'utf8'}).trim();
execFileSync('/usr/bin/swiftc', ['-sdk', sdk, '-module-cache-path', '/tmp/meeting-controls-swift-cache',
  'helper/Controls.swift', 'helper/main.swift', '-o', path.join(helper, 'Contents/MacOS/MeetingControlsHelper')]);
writeFileSync(path.join(helper, 'Contents/Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>CFBundleIdentifier</key><string>com.mati.meeting-controls-helper</string><key>CFBundleName</key><string>Meeting Controls Helper</string><key>CFBundleExecutable</key><string>MeetingControlsHelper</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleVersion</key><string>1</string><key>LSUIElement</key><true/></dict></plist>`);
execFileSync('/usr/bin/codesign', ['--force', '--sign', '-', helper]);
console.log('Built extension, Stream Deck plugin, and signed Slack helper in dist/.');
