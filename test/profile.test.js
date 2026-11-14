import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildProfile} from '../profile.js';

test('profile archive uses version 3 UUID page directories and contains all controls', t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'meeting-profile-test-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  buildProfile(directory);
  const archive = path.join(directory, 'profiles/Meeting Mode.streamDeckProfile');
  const entries = execFileSync('/usr/bin/unzip', ['-Z1', archive], {encoding: 'utf8'}).split('\n');
  const root = entries.find(name => /^[^/]+\/manifest.json$/.test(name));
  const read = name => JSON.parse(execFileSync('/usr/bin/unzip', ['-p', archive, name], {encoding: 'utf8'}));
  const manifest = read(root);
  assert.equal(manifest.Version, '3.0');
  const page = read(root.replace('manifest.json', `Profiles/${manifest.Pages.Current.toUpperCase()}/manifest.json`));
  assert.equal(Object.keys(page.Controllers[0].Actions).length, 15);
  assert.equal(manifest.Device.UUID, '');
});
