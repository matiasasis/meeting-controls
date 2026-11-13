import Foundation

@main
struct ControlsTests {
    static func main() {
        let fixtures: [(MeetingControl, String, String?)] = [
            (.mic, "Mute microphone", "on"), (.mic, "Unmute (⌘⇧Space)", "off"),
            (.mic, "Mute all participants", nil), (.mic, "Record audio clip", nil),
            (.camera, "Turn camera on", "off"), (.camera, "Turn off camera", "on"),
            (.camera, "Preview your video", nil), (.camera, "Start video", "off"),
            (.mic, "Microphone settings", nil), (.camera, "Share screen", nil)
        ]
        for (kind, label, expected) in fixtures {
            precondition(kind.state(label: label) == expected, "Unexpected state for \(label)")
        }
        print("10 Slack control label fixtures passed")
    }
}
