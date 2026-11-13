# Local Meeting Controls

Two Stream Deck keys control Google Meet in Chrome and Slack Huddles in the desktop app. All communication stays on this Mac. There is no account, subscription, cloud service, or collection of meeting audio, video, chat, or participants.

The extension is restricted to `meet.google.com`. The macOS helper reads accessibility button labels in Slack and presses only the recognized microphone or camera control. English meeting controls are required for this version.

## Button behavior

- Green: microphone/camera on. Red with a slash: off.
- Gray: no call or unknown state; commands are refused when the state cannot be read.
- The button says MEET or SLACK so you can see which call it controls.
- When both are active, focus the desired call once. It remains selected while you work in another app.
- WAIT means a command is in progress. There is no automatic retry, and another press is ignored until the result is confirmed.
- The plugin refuses stale state and never starts or joins a call.

## Build

Run `npm ci --ignore-scripts`, `npm test`, and `node build.js`. On a Mac with an SDK/compiler mismatch, set `SWIFT_SDK` to a compatible installed SDK. Test Swift label recognition by compiling `helper/Controls.swift` with `test/ControlsTests.swift`.

## Local installation

1. Copy `dist/com.mati.meetingcontrols.sdPlugin` into `~/Library/Application Support/com.elgato.StreamDeck/Plugins/` while Stream Deck is closed, then reopen it.
2. Copy `dist/Meeting Controls Helper.app` into `~/Applications/`.
3. Load `dist/extension` using **Load unpacked** at `chrome://extensions` with Developer mode enabled. Keep it at a permanent path. Reload Meet tabs opened before installation.
4. In macOS **System Settings → Privacy & Security → Accessibility**, add and enable **Meeting Controls Helper**. This permission is required for Slack desktop controls. macOS grants broad accessibility capability; this helper's implementation targets only Slack.
5. Add **Meeting Microphone** and **Meeting Camera** to your Stream Deck.

Build output contains a random local pairing secret shared by the extension and plugin. Do not publish `dist/`. The server listens only on `127.0.0.1:18765`, accepts extension origins, requires the secret, and limits message sizes. It accepts no remote HTTP commands.

## Verification

The extension popup shows its connection and the detected Meet mic/camera state. Test toggles in an empty call before relying on them in a meeting. Slack's UI and Meet's labels can change; unrecognized or ambiguous controls disable the button instead of guessing. Huddles controls must remain exposed in Slack's accessibility tree; if a collapsed huddle is not detected, expand its window.

To uninstall, remove the two keys and plugin, remove the Chrome extension, remove the helper from Accessibility, and delete the local source directory and helper app.
