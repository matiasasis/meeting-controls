import test from 'node:test';
import assert from 'node:assert/strict';
import {MeetingNavigation} from '../plugin/navigation.js';

function fixture() {
  let time = 0;
  const calls = [];
  const navigation = new MeetingNavigation((device, payload) => {
    calls.push({device, payload});
    navigation.visible(device, !!payload.profile);
  }, () => time);
  navigation.register('deck');
  return {navigation, calls, advance: milliseconds => { time += milliseconds; }};
}

test('joining switches once; Home stays home; Meeting reopens without ending the call', () => {
  const {navigation, calls} = fixture();
  navigation.update(true);
  navigation.update(true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].payload.profile, 'profiles/Meeting Mode');
  navigation.home('deck');
  navigation.update(true);
  navigation.update(true);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].payload, {});
  navigation.open('deck');
  assert.equal(calls.length, 3);
});

test('a profile-install prompt does not prevent retrying the open request', () => {
  const calls = [];
  const navigation = new MeetingNavigation((...args) => calls.push(args));
  navigation.register('deck');
  navigation.open('deck');
  navigation.open('deck');
  assert.equal(calls.length, 2);
});

test('a short disconnect does not override Home, and a later call switches again', () => {
  const {navigation, calls, advance} = fixture();
  navigation.update(true);
  navigation.home('deck');
  navigation.update(false);
  advance(3000);
  navigation.update(true);
  assert.equal(calls.length, 2);
  navigation.update(false);
  advance(10000);
  navigation.update(false);
  assert.equal(calls.length, 2);
  navigation.update(true);
  assert.equal(calls.length, 3);
});

test('ending restores Home only when Meeting mode is still visible', () => {
  const {navigation, calls, advance} = fixture();
  navigation.update(true);
  navigation.update(false);
  advance(10000);
  navigation.update(false);
  assert.deepEqual(calls.at(-1).payload, {});
  navigation.update(true);
  navigation.visible('deck', false);
  navigation.update(false);
  advance(10000);
  navigation.update(false);
  assert.equal(calls.length, 3);
});

test('restarting on Meeting mode does not switch to the same profile again', () => {
  const calls = [];
  const navigation = new MeetingNavigation((...args) => calls.push(args));
  navigation.update(true);
  navigation.register('deck', true);
  assert.equal(calls.length, 0);
  navigation.home('deck');
  assert.deepEqual(calls, [['deck', {}]]);
});
