import test from 'node:test';
import assert from 'node:assert/strict';
import {MeetingRegistry} from '../plugin/registry.js';

test('selects the last focused call and retains it while another app is in front', () => {
  let now = 1;
  const registry = new MeetingRegistry(() => now++);
  registry.update('meet:1', {active: true, focused: true});
  registry.update('meet:1', {active: true, focused: false});
  registry.update('slack', {active: true, focused: true});
  registry.update('slack', {active: true, focused: false});
  assert.equal(registry.target().id, 'slack');
  registry.update('meet:1', {active: true, focused: true});
  assert.equal(registry.target().id, 'meet:1');
});

test('disables stale calls and removes disconnected browser calls without affecting Slack', () => {
  let now = 0;
  const registry = new MeetingRegistry(() => now);
  registry.update('meet:1', {active: true});
  now = 5001;
  assert.equal(registry.target(), null);
  registry.update('slack', {active: true});
  registry.update('meet:2', {active: true});
  registry.removeBrowser();
  assert.equal(registry.target().id, 'slack');
  registry.update('slack', {active: false});
  assert.equal(registry.target(), null);
});
