import test from 'node:test';
import assert from 'node:assert/strict';
import {HeldKeys, available} from '../plugin/actions.js';
import {buttonImage} from '../plugin/icons.js';
import {profileActions} from '../profile.js';

test('leave requires a full hold on the same call', () => {
  let time = 0;
  const keys = new HeldKeys(() => time);
  keys.down('key', 'meet:1');
  time = 799;
  assert.equal(keys.up('key', 'meet:1'), false);
  keys.down('key', 'meet:1');
  time += 800;
  assert.equal(keys.up('key', 'meet:2'), false);
  keys.down('key', 'meet:2');
  time += 800;
  assert.equal(keys.up('key', 'meet:2'), true);
  assert.equal(keys.up('key', 'meet:2'), false);
});

test('unsupported Slack controls stay disabled while Home is always available', () => {
  const slack = {app: 'Slack', mic: 'on', camera: 'off'};
  assert.equal(available('mic', slack), true);
  for (const kind of ['hand', 'captions', 'heart', 'share', 'leave']) assert.equal(available(kind, slack), false);
  assert.equal(available('home', null), true);
  const svg = Buffer.from(buttonImage('hand', slack).split(',')[1], 'base64').toString();
  assert.match(svg, /#424754/);
});

test('the bundled 15-key layout includes Home and leaves user profiles untouched', () => {
  const actions = profileActions();
  assert.equal(Object.keys(actions).length, 15);
  assert.equal(actions['0,0'].UUID, 'com.mati.meetingcontrols.home');
  assert.equal(actions['4,2'].UUID, 'com.mati.meetingcontrols.leave');
  assert.ok(Object.values(actions).every(action => action.UUID.startsWith('com.mati.meetingcontrols.')));
});
