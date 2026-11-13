import AppKit
import ApplicationServices

struct HelperError: Error {
    let message: String
}

func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
    var result: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, name as CFString, &result) == .success else { return nil }
    return result
}

func string(_ element: AXUIElement, _ name: String) -> String {
    attribute(element, name) as? String ?? ""
}

struct Button {
    let element: AXUIElement
    let labels: [String]

    func state(_ kind: MeetingControl) -> String? {
        let states = Set(labels.compactMap { kind.state(label: $0) })
        return states.count == 1 ? states.first : nil
    }
}

struct Huddle {
    let buttons: [Button]
    let focused: Bool

    func control(_ kind: MeetingControl) -> Button? {
        let matches = buttons.filter { $0.state(kind) != nil }
        return matches.count == 1 ? matches.first : nil
    }

    var status: [String: Any] {
        ["active": true, "focused": focused,
         "mic": control(.mic)?.state(.mic) ?? "unknown",
         "camera": control(.camera)?.state(.camera) ?? "unknown"]
    }
}

func windowButtons(_ window: AXUIElement) -> [Button] {
    var queue = [window]
    var offset = 0
    var buttons: [Button] = []
    while offset < queue.count && offset < 4000 {
        let element = queue[offset]
        offset += 1
        let role = string(element, kAXRoleAttribute)
        if [kAXButtonRole, kAXCheckBoxRole].contains(role) {
            let enabled = attribute(element, kAXEnabledAttribute) as? Bool ?? true
            if enabled {
                buttons.append(Button(element: element, labels: [kAXTitleAttribute, kAXDescriptionAttribute, kAXHelpAttribute].map { string(element, $0) }))
            }
        }
        if let children = attribute(element, kAXChildrenAttribute) as? [AXUIElement] {
            queue.append(contentsOf: children)
        }
    }
    return buttons
}

func findHuddle() throws -> Huddle? {
    guard let slack = NSRunningApplication.runningApplications(withBundleIdentifier: "com.tinyspeck.slackmacgap").first else { return nil }
    guard AXIsProcessTrusted() else { throw HelperError(message: "Accessibility permission is required for Slack controls") }
    let application = AXUIElementCreateApplication(slack.processIdentifier)
    AXUIElementSetMessagingTimeout(application, 0.25)
    guard let windows = attribute(application, kAXWindowsAttribute) as? [AXUIElement] else { return nil }
    let focused = NSWorkspace.shared.frontmostApplication?.processIdentifier == slack.processIdentifier
    for window in windows {
        let buttons = windowButtons(window)
        let title = string(window, kAXTitleAttribute).lowercased()
        let inHuddle = buttons.contains { button in
            button.labels.contains { label in
                let text = label.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
                return text == "leave huddle" || text == "leave huddle (⌘⇧h)" || (title.contains("huddle") && text == "leave")
            }
        }
        if inHuddle { return Huddle(buttons: buttons, focused: focused) }
    }
    return nil
}

func status() throws -> [String: Any] {
    try findHuddle()?.status ?? ["active": false, "focused": false, "mic": "unknown", "camera": "unknown"]
}

func toggle(_ kind: MeetingControl, expected: String) throws -> [String: Any] {
    guard let huddle = try findHuddle(), let button = huddle.control(kind), button.state(kind) == expected else {
        throw HelperError(message: "Huddle control changed or is unavailable")
    }
    guard AXUIElementPerformAction(button.element, kAXPressAction as CFString) == .success else {
        throw HelperError(message: "Slack did not accept the button press")
    }
    for _ in 0..<10 {
        Thread.sleep(forTimeInterval: 0.1)
        let state = try status()
        if let current = state[kind.rawValue] as? String, ["on", "off"].contains(current), current != expected { return state }
    }
    throw HelperError(message: "Slack did not confirm the change")
}

func execute() throws -> [String: Any] {
    let args = Array(CommandLine.arguments.dropFirst())
    if args.first == "status" { return try status() }
    if args.count == 3, args[0] == "toggle", let kind = MeetingControl(rawValue: args[1]), ["on", "off"].contains(args[2]) {
        return try toggle(kind, expected: args[2])
    }
    throw HelperError(message: "Expected status or toggle mic|camera on|off")
}

let result: [String: Any]
do { result = try execute() }
catch let error as HelperError { result = ["error": error.message] }
catch { result = ["error": "Unable to read Slack controls"] }
if let data = try? JSONSerialization.data(withJSONObject: result), let output = String(data: data, encoding: .utf8) { print(output) }
