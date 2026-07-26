import ApplicationServices
import Foundation
import GameController

enum Profile: String {
    case nes
    case pce
    case genesis
    case sms
}

struct KeyProfile {
    let dpadUp: CGKeyCode
    let dpadDown: CGKeyCode
    let dpadLeft: CGKeyCode
    let dpadRight: CGKeyCode
    let buttonSouth: CGKeyCode
    let buttonEast: CGKeyCode
    let buttonWest: CGKeyCode
    let buttonNorth: CGKeyCode
    let minus: CGKeyCode
    let plus: CGKeyCode
    let leftShoulder: CGKeyCode?
    let rightShoulder: CGKeyCode?
}

// macOS virtual key codes for the keys already used in Mednafen's keyboard bindings.
enum MacKey {
    static let a: CGKeyCode = 0
    static let s: CGKeyCode = 1
    static let d: CGKeyCode = 2
    static let f: CGKeyCode = 3
    static let h: CGKeyCode = 4
    static let g: CGKeyCode = 5
    static let c: CGKeyCode = 8
    static let b: CGKeyCode = 11
    static let q: CGKeyCode = 12
    static let w: CGKeyCode = 13
    static let e: CGKeyCode = 14
    static let r: CGKeyCode = 15
    static let u: CGKeyCode = 32
    static let i: CGKeyCode = 34
    static let j: CGKeyCode = 38
    static let k: CGKeyCode = 40
    static let n: CGKeyCode = 45
    static let m: CGKeyCode = 46
}

let profiles: [Profile: KeyProfile] = [
    .nes: KeyProfile(
        dpadUp: MacKey.w,
        dpadDown: MacKey.s,
        dpadLeft: MacKey.a,
        dpadRight: MacKey.d,
        buttonSouth: MacKey.n,
        buttonEast: MacKey.m,
        buttonWest: MacKey.h,
        buttonNorth: MacKey.j,
        minus: MacKey.q,
        plus: MacKey.e,
        leftShoulder: nil,
        rightShoulder: nil
    ),
    .pce: KeyProfile(
        dpadUp: MacKey.w,
        dpadDown: MacKey.s,
        dpadLeft: MacKey.a,
        dpadRight: MacKey.d,
        buttonSouth: MacKey.j,
        buttonEast: MacKey.h,
        buttonWest: MacKey.n,
        buttonNorth: MacKey.u,
        minus: MacKey.q,
        plus: MacKey.e,
        leftShoulder: nil,
        rightShoulder: nil
    ),
    .genesis: KeyProfile(
        dpadUp: MacKey.w,
        dpadDown: MacKey.s,
        dpadLeft: MacKey.a,
        dpadRight: MacKey.d,
        buttonSouth: MacKey.n,
        buttonEast: MacKey.m,
        buttonWest: MacKey.b,
        buttonNorth: MacKey.h,
        minus: MacKey.u,
        plus: MacKey.e,
        leftShoulder: MacKey.j,
        rightShoulder: MacKey.k
    ),
    .sms: KeyProfile(
        dpadUp: MacKey.w,
        dpadDown: MacKey.s,
        dpadLeft: MacKey.a,
        dpadRight: MacKey.d,
        buttonSouth: MacKey.m,
        buttonEast: MacKey.n,
        buttonWest: MacKey.m,
        buttonNorth: MacKey.n,
        minus: MacKey.e,
        plus: MacKey.e,
        leftShoulder: nil,
        rightShoulder: nil
    ),
]

final class KeyboardBridge {
    private let profile: KeyProfile
    private let source = CGEventSource(stateID: .hidSystemState)
    private var heldKeys = Set<CGKeyCode>()

    init(profile: KeyProfile) {
        self.profile = profile
    }

    func setKey(_ key: CGKeyCode, pressed: Bool) {
        if pressed && heldKeys.contains(key) { return }
        if !pressed && !heldKeys.contains(key) { return }

        guard let source = source,
              let event = CGEvent(keyboardEventSource: source, virtualKey: key, keyDown: pressed)
        else { return }

        event.post(tap: .cghidEventTap)

        if pressed {
            heldKeys.insert(key)
        } else {
            heldKeys.remove(key)
        }
    }

    func releaseAll() {
        for key in heldKeys {
            setKey(key, pressed: false)
        }
    }

    func bind(controller: GCController) {
        guard let gamepad = controller.extendedGamepad else { return }

        gamepad.dpad.up.pressedChangedHandler = { [weak self] _, _, pressed in
            self?.setKey(self?.profile.dpadUp ?? 0, pressed: pressed)
        }
        gamepad.dpad.down.pressedChangedHandler = { [weak self] _, _, pressed in
            self?.setKey(self?.profile.dpadDown ?? 0, pressed: pressed)
        }
        gamepad.dpad.left.pressedChangedHandler = { [weak self] _, _, pressed in
            self?.setKey(self?.profile.dpadLeft ?? 0, pressed: pressed)
        }
        gamepad.dpad.right.pressedChangedHandler = { [weak self] _, _, pressed in
            self?.setKey(self?.profile.dpadRight ?? 0, pressed: pressed)
        }

        gamepad.leftThumbstick.up.pressedChangedHandler = { [weak self] _, _, pressed in
            self?.setKey(self?.profile.dpadUp ?? 0, pressed: pressed)
        }
        gamepad.leftThumbstick.down.pressedChangedHandler = { [weak self] _, _, pressed in
            self?.setKey(self?.profile.dpadDown ?? 0, pressed: pressed)
        }
        gamepad.leftThumbstick.left.pressedChangedHandler = { [weak self] _, _, pressed in
            self?.setKey(self?.profile.dpadLeft ?? 0, pressed: pressed)
        }
        gamepad.leftThumbstick.right.pressedChangedHandler = { [weak self] _, _, pressed in
            self?.setKey(self?.profile.dpadRight ?? 0, pressed: pressed)
        }

        gamepad.buttonA.pressedChangedHandler = { [weak self] _, _, pressed in
            self?.setKey(self?.profile.buttonSouth ?? 0, pressed: pressed)
        }
        gamepad.buttonB.pressedChangedHandler = { [weak self] _, _, pressed in
            self?.setKey(self?.profile.buttonEast ?? 0, pressed: pressed)
        }
        gamepad.buttonX.pressedChangedHandler = { [weak self] _, _, pressed in
            self?.setKey(self?.profile.buttonWest ?? 0, pressed: pressed)
        }
        gamepad.buttonY.pressedChangedHandler = { [weak self] _, _, pressed in
            self?.setKey(self?.profile.buttonNorth ?? 0, pressed: pressed)
        }

        gamepad.leftShoulder.pressedChangedHandler = { [weak self] _, _, pressed in
            guard let key = self?.profile.leftShoulder else { return }
            self?.setKey(key, pressed: pressed)
        }
        gamepad.rightShoulder.pressedChangedHandler = { [weak self] _, _, pressed in
            guard let key = self?.profile.rightShoulder else { return }
            self?.setKey(key, pressed: pressed)
        }

        gamepad.buttonOptions?.pressedChangedHandler = { [weak self] _, _, pressed in
            self?.setKey(self?.profile.plus ?? 0, pressed: pressed)
        }
        gamepad.buttonMenu.pressedChangedHandler = { [weak self] _, _, pressed in
            self?.setKey(self?.profile.minus ?? 0, pressed: pressed)
        }
    }
}

func parseProfile() -> Profile? {
    let args = CommandLine.arguments
    guard let index = args.firstIndex(of: "--profile"), args.indices.contains(index + 1) else {
        return nil
    }
    return Profile(rawValue: args[index + 1])
}

guard let profileName = parseProfile(), let keyProfile = profiles[profileName] else {
    fputs("Usage: mednafen_gc_bridge --profile <nes|pce|genesis|sms>\n", stderr)
    exit(2)
}

let bridge = KeyboardBridge(profile: keyProfile)

signal(SIGINT) { _ in
    bridge.releaseAll()
    exit(0)
}
signal(SIGTERM) { _ in
    bridge.releaseAll()
    exit(0)
}

func bindAvailableControllers() {
    for controller in GCController.controllers() {
        bridge.bind(controller: controller)
    }
}

NotificationCenter.default.addObserver(
    forName: .GCControllerDidConnect,
    object: nil,
    queue: .main
) { notification in
    if let controller = notification.object as? GCController {
        bridge.bind(controller: controller)
    }
}

bindAvailableControllers()
RunLoop.main.run()
