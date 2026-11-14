import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

function meeting(html = '<button aria-label="Leave call"></button><button aria-label="Turn on microphone"></button><button aria-label="Turn off camera"></button>') {
  const dom = new JSDOM(html, {runScripts: 'outside-only'});
  dom.window.HTMLElement.prototype.getClientRects = function() { return this.style.display === 'none' ? [] : [{}]; };
  dom.window.eval(readFileSync(new URL('../extension/meet-controls.js', import.meta.url), 'utf8'));
  return {document: dom.window.document, controls: dom.window.meetControls};
}

test('reads independent microphone and camera states', () => {
  const {document, controls} = meeting();
  assert.equal(controls.state(document).mic, 'off');
  assert.equal(controls.state(document).camera, 'on');
});

test('does not control pre-join, hidden or ambiguous controls', async () => {
  for (const html of [
    '<button aria-label="Turn on microphone"></button>',
    '<button aria-label="Leave call"></button><button hidden aria-label="Turn on microphone"></button>',
    '<button aria-label="Leave call"></button><button aria-label="Turn on microphone"></button><button aria-label="Turn off microphone"></button>'
  ]) {
    const {document, controls} = meeting(html);
    let clicked = false;
    document.addEventListener('click', () => { clicked = true; });
    await assert.rejects(controls.toggle(document, 'mic', 'off'));
    assert.equal(clicked, false);
  }
});

test('clicks only the requested control and waits for reported state', async () => {
  const {document, controls} = meeting();
  let clicks = 0;
  document.querySelector('[aria-label="Turn on microphone"]').onclick = event => {
    clicks++;
    event.target.setAttribute('aria-label', 'Turn off microphone');
  };
  const state = await controls.toggle(document, 'mic', 'off');
  assert.equal(state.mic, 'on');
  assert.equal(state.camera, 'on');
  assert.equal(clicks, 1);
});

test('rejects stale expectations without clicking', async () => {
  const {document, controls} = meeting();
  document.querySelector('button').onclick = () => assert.fail('must not click');
  await assert.rejects(controls.toggle(document, 'mic', 'on'));
});

test('does not report success when Meet ignores a click', async () => {
  const {document, controls} = meeting();
  await assert.rejects(controls.toggle(document, 'mic', 'off'), /did not confirm/);
});

test('hand and captions use reported state and ignore unrelated participant controls', async () => {
  const {document, controls} = meeting('<button aria-label="Leave call"></button><button aria-label="Raise hand (ctrl + ⌘ + h)"></button><button aria-label="Lower all hands"></button><button aria-label="Captions and translation" aria-pressed="false"></button>');
  const hand = document.querySelector('[aria-label^="Raise hand"]');
  hand.onclick = () => hand.setAttribute('aria-label', 'Lower hand');
  assert.equal((await controls.toggle(document, 'hand', 'off')).hand, 'on');
  assert.equal(controls.state(document).captions, 'off');
});

test('a reaction opens the palette and clicks exactly the requested emoji', async () => {
  const {document, controls} = meeting('<button aria-label="Leave call"></button><button aria-label="Send a reaction"></button>');
  let sent = 0;
  document.querySelector('[aria-label="Send a reaction"]').onclick = () => {
    const emoji = document.createElement('button');
    emoji.setAttribute('aria-label', 'Red heart');
    emoji.onclick = () => { sent++; };
    document.body.append(emoji);
  };
  await controls.perform(document, 'heart');
  assert.equal(sent, 1);
});

test('missing or disabled reactions are refused and do not click another action', async () => {
  const {document, controls} = meeting();
  let clicks = 0;
  document.addEventListener('click', () => { clicks++; });
  await assert.rejects(controls.perform(document, 'clap'));
  await assert.rejects(controls.perform(document, 'unknown'));
  assert.equal(clicks, 0);
});

test('leave returns the ended state and share opens only the app picker', async () => {
  const {document, controls} = meeting('<button aria-label="Leave call"></button><button aria-label="Present now"></button>');
  let picker = 0;
  document.querySelector('[aria-label="Present now"]').onclick = () => { picker++; };
  await controls.perform(document, 'share');
  assert.equal(picker, 1);
  document.querySelector('[aria-label="Leave call"]').onclick = event => event.target.remove();
  assert.equal((await controls.perform(document, 'leave')).active, false);
});
