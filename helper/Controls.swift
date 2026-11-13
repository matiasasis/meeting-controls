import Foundation

enum MeetingControl: String {
    case mic, camera

    func state(label: String) -> String? {
        let text = label.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let patterns: [(String, String)]
        switch self {
        case .mic:
            patterns = [
                ("off", "^(unmute|unmute (your )?(microphone|mic)|turn on (your )?microphone)( \\(.*\\))?$"),
                ("on", "^(mute|mute (your )?(microphone|mic)|turn off (your )?microphone)( \\(.*\\))?$")
            ]
        case .camera:
            patterns = [
                ("off", "^(turn (your )?(camera|video) on|turn on (your )?(camera|video)|start (your )?(camera|video))( \\(.*\\))?$"),
                ("on", "^(turn (your )?(camera|video) off|turn off (your )?(camera|video)|stop (your )?(camera|video))( \\(.*\\))?$")
            ]
        }
        return patterns.first { text.range(of: $0.1, options: .regularExpression) != nil }?.0
    }
}
