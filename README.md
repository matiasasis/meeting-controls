# Meeting Controls for Stream Deck

A meeting profile for your 15-key Stream Deck controls Google Meet in Chrome and Slack Huddles in the desktop app. All communication stays on this Mac. There is no account, subscription, cloud service, or collection of meeting audio, video, chat, or participants.

This is an early local prototype for macOS. Installation and the Chrome-to-Stream-Deck connection have been verified. Automated tests cover routing, authentication, state detection, and simulated toggles; physical-key toggles in real Meet calls and Slack Huddles still need end-to-end verification.

## Features

- One deck for Google Meet in Chrome and Slack desktop Huddles.
- Automatic meeting screen, with **Home** and **Meeting Mode** navigation.
- Icons reflect the reported microphone and camera state.
- Meet hand raising, captions, reactions, screen-sharing picker, and hold-to-leave.
- A bundled 15-key profile: install the layout once instead of configuring every button.
- Free, open source, and local to your Mac.

![Meeting Mode profile with no active call](https://github.com/user-attachments/assets/4b177a3d-5bcd-4eca-9f3c-909653e68ef2)

## Supported controls

| Control | Google Meet · Chrome | Slack Huddles · desktop |
|---|---|---|
| Microphone and camera | Yes | Yes |
| Automatic meeting profile and Home | Yes | Yes |
| Show call | Focuses Meet tab | Opens Slack |
| Raise/lower hand and captions | Yes | Not yet |
| Emoji reactions | Yes | Not yet |
| Screen sharing | Opens the sharing picker | Not yet |
| Hold to leave | Yes | Not yet |

Unavailable controls stay gray. This prototype requires English control labels. Windows, other browsers, Slack in the browser, and other Stream Deck sizes are not currently supported.

## How it works

- **Chrome extension (JavaScript, Manifest V3):** reads Meet's microphone and camera button labels and clicks the requested control, including while the tab is in the background.
- **Stream Deck plugin (JavaScript on Node.js):** receives physical key presses, selects the last focused meeting, and draws icons from the reported state.
- **Local WebSocket bridge:** connects the plugin and extension on this Mac, authenticated with a randomly generated pairing secret.
- **Slack helper (Swift with AppKit and Accessibility):** locates the desktop Huddle controls and presses the requested button, after checking its current state.
- **Popup (HTML/CSS):** shows the extension connection and detected Meet state.

Node's test runner and jsdom exercise the browser and plugin code. Swift fixtures test Slack label recognition. There is no hosted backend or database.

The extension is restricted to `meet.google.com`. The macOS helper reads accessibility button labels in Slack and presses only the recognized microphone or camera control. English meeting controls are required for this version.

## Button behavior

- Green: microphone/camera on. Red with a slash: off.
- Gray: no call or unknown state; commands are refused when the state cannot be read.
- The button says MEET or SLACK so you can see which call it controls.
- When both are active, focus the desired call once. It remains selected while you work in another app.
- WAIT means a command is in progress. There is no automatic retry, and another press is ignored until the result is confirmed.
- The plugin refuses stale state and never starts or joins a call.

## Meeting mode

Joining a detected call opens the meeting profile. **Home** returns to your previous profile and stays there during the call; press **Meeting Mode** to return. Ending the call restores your previous profile if the meeting profile is still visible. A 10-second grace period avoids switching profiles during brief connection interruptions.

| Row | Key 1 | Key 2 | Key 3 | Key 4 | Key 5 |
|---|---|---|---|---|---|
| Top | Microphone | Camera | Raise/lower hand | Share screen | Captions |
| Middle | 👍 | ❤️ | 😂 | 🎉 | 👏 |
| Bottom | Show call | Call status | Reactions | Home | Hold to leave |

Google Meet supports all controls when its corresponding English buttons are available. Sharing opens Meet’s normal picker; choose what to share there. Hold **Leave** for at least 0.8 seconds, then release. If Meet requests confirmation, finish it in Meet. Emoji buttons send a reaction immediately.

Slack desktop supports microphone, camera, and Show call. Meet-only controls remain disabled for Huddles. Home and Meeting Mode work for either app. The bundled layout targets 15-key Stream Decks; other sizes are not yet supported.

## Build from source

Meeting mode is currently available in [draft PR #1](https://github.com/matiasasis/streamdeck-meeting-controls/pull/1). Until it is merged, run `git switch meeting-mode` after cloning to try the profile shown above. The default branch contains the earlier microphone/camera prototype.


Requires macOS 12 or later, Xcode Command Line Tools, Node.js 20 or later, Chrome 120 or later, and Stream Deck 6.5 or later. This version recognizes English meeting-control labels.

```sh
git clone https://github.com/matiasasis/streamdeck-meeting-controls.git
cd streamdeck-meeting-controls
npm ci --ignore-scripts
npm test
node build.js
```

On a Mac with an SDK/compiler mismatch, set `SWIFT_SDK` to a compatible installed SDK. Test Swift label recognition by compiling `helper/Controls.swift` with `test/ControlsTests.swift`.

## Local installation

1. Copy `dist/com.mati.meetingcontrols.sdPlugin` into `~/Library/Application Support/com.elgato.StreamDeck/Plugins/` while Stream Deck is closed, then reopen it.
2. Copy `dist/Meeting Controls Helper.app` into `~/Applications/`.
3. Load `dist/extension` using **Load unpacked** at `chrome://extensions` with Developer mode enabled. Keep it at a permanent path. Reload Meet tabs opened before installation.
4. In macOS **System Settings → Privacy & Security → Accessibility**, add and enable **Meeting Controls Helper**. This permission is required for Slack desktop controls. macOS grants broad accessibility capability; this helper's implementation targets only Slack.
5. Add **Meeting Mode** to your normal Stream Deck profile. Open it once and accept Stream Deck’s bundled-profile installation prompt. You can also keep standalone **Microphone** and **Camera** keys.

Build output contains a random local pairing secret shared by the extension and plugin. Do not publish `dist/`. The server listens only on `127.0.0.1:18765`, accepts extension origins, requires the secret, and limits message sizes. It accepts no remote HTTP commands.

## Share the profile

The build produces `dist/com.mati.meetingcontrols.sdPlugin/profiles/Meeting Mode.streamDeckProfile`. This layout contains the 15 button assignments and can be shared; it does not contain the local pairing secret. The plugin already bundles it, so most users only need to add the **Meeting Mode** launcher and accept the installation prompt.

A profile alone does not install the plugin, Chrome extension, or Slack helper. Each person should build and install their own matching plugin and extension to generate their own local pairing secret. Do not share the entire `dist/` directory, `pairing-token`, `local-config.json`, or generated `extension/config.js`.

There is no packaged installer or marketplace release yet. Installation currently uses the source build and manual steps above.

## Troubleshooting

| Symptom | Check |
|---|---|
| Chrome popup says disconnected | Stream Deck must be running with the plugin installed. Use the extension and plugin from the same build. |
| Meet is not detected | Reload the Meet tab after updating the extension. Join a call first; the pre-join screen is intentionally ignored. |
| Slack controls stay gray | Enable the helper in macOS Accessibility and expand the Huddle window so its buttons are exposed. |
| A particular control is gray | The app may not expose that control, or its label/state is unknown. English labels are required. |
| Meeting profile does not open | Add the Meeting Mode launcher to your normal profile and open it once to accept the profile installation prompt. |
| Wrong meeting is selected | Focus the desired call once. The plugin keeps that selection while you work elsewhere. |

## Verification

The extension popup shows its connection and the detected Meet mic/camera state. Test toggles in an empty call before relying on them in a meeting. Slack's UI and Meet's labels can change; unrecognized or ambiguous controls disable the button instead of guessing. Huddles controls must remain exposed in Slack's accessibility tree; if a collapsed huddle is not detected, expand its window.

To uninstall, remove the meeting profile, launcher keys, and plugin, remove the Chrome extension, remove the helper from Accessibility, and delete the local source directory and helper app.

## Contributing

Bug reports and pull requests are welcome. Include your macOS, Chrome, Slack, and Stream Deck versions, the meeting app affected, and whether the button showed an incorrect state or failed to toggle. Do not include meeting contents, participant details, or your generated pairing secret.

Run the JavaScript tests and Swift label fixtures before submitting changes. Changes to app detection should include a regression fixture for the relevant control labels.

## License

[MIT](LICENSE). This is an independent project, not affiliated with Google, Slack, or Elgato.
