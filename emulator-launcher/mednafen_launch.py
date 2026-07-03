#!/usr/bin/env python3
"""Launch Mednafen with stable RetroCore controller bindings.

This wrapper keeps the Nintendo Switch Pro Controller bindings for NES and
TurboGrafx-16/PC Engine consistent across launches, and blocks multi-instance
launches that can cause Mednafen to lose settings updates.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import threading
import time
from collections import Counter
from pathlib import Path

CFG_PATH = Path.home() / ".mednafen" / "mednafen.cfg"
BACKUP_PATH = CFG_PATH.with_name("mednafen.cfg.retrocore.backup")
BASE_DIR = Path(__file__).resolve().parent
BRIDGE_SOURCE = BASE_DIR / "mednafen_gc_bridge.swift"
BRIDGE_BINARY = BASE_DIR / "mednafen_gc_bridge"


def notify(title: str, message: str) -> None:
    script = f'display alert "{title}" message "{message}" as warning'
    subprocess.run(["osascript", "-e", script], check=False, capture_output=True)


def send_reinit_hotkey() -> None:
    script = (
        'tell application "System Events" to keystroke "r" '
        'using {control down, option down, shift down}'
    )
    subprocess.run(["osascript", "-e", script], check=False, capture_output=True)


def schedule_reinit_hotkeys() -> None:
    def worker() -> None:
        for delay in (1.5, 4.0):
            time.sleep(delay)
            send_reinit_hotkey()

    threading.Thread(target=worker, daemon=True).start()


def detect_profile(mednafen_args: list[str]) -> str | None:
    for arg in mednafen_args:
        if not arg or arg.startswith("-"):
            continue
        lower_arg = arg.lower()
        if "/nes/" in lower_arg:
            return "nes"
        if "/tg16/" in lower_arg or "/pc engine/" in lower_arg or lower_arg.endswith(".pce"):
            return "pce"
        if "/genesis/" in lower_arg:
            return "genesis"
        if "/sms/" in lower_arg:
            return "sms"
    return None


def ensure_bridge_binary() -> bool:
    if not BRIDGE_SOURCE.exists():
        return False

    if BRIDGE_BINARY.exists() and BRIDGE_BINARY.stat().st_mtime >= BRIDGE_SOURCE.stat().st_mtime:
        return True

    result = subprocess.run(
        [
            "swiftc",
            "-framework",
            "Foundation",
            "-framework",
            "GameController",
            "-framework",
            "ApplicationServices",
            str(BRIDGE_SOURCE),
            "-o",
            str(BRIDGE_BINARY),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        return False
    return True


def start_bridge(profile: str | None) -> subprocess.Popen[str] | None:
    if not profile:
        return None
    if not ensure_bridge_binary():
        return None

    return subprocess.Popen(
        [str(BRIDGE_BINARY), "--profile", profile],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        text=True,
    )


def running_mednafen_pids() -> list[int]:
    result = subprocess.run(
        ["pgrep", "-x", "mednafen"], capture_output=True, text=True, check=False
    )
    if result.returncode not in (0, 1):
        return []
    return [int(line) for line in result.stdout.splitlines() if line.strip().isdigit()]


def infer_joystick_id(cfg_text: str) -> str | None:
    env_id = os.environ.get("RETROCORE_MEDNAFEN_JOYSTICK_ID")
    if env_id:
        return env_id

    ids = re.findall(r"\bjoystick (0x[0-9a-f]+)\b", cfg_text)
    if not ids:
        return None
    return Counter(ids).most_common(1)[0][0]


def set_setting(cfg_text: str, key: str, value: str) -> str:
    pattern = re.compile(rf"(?m)^{re.escape(key)}(?:\s+.*)?$")
    line = f"{key} {value}"
    if pattern.search(cfg_text):
        return pattern.sub(line, cfg_text, count=1)
    suffix = "" if cfg_text.endswith("\n") else "\n"
    return f"{cfg_text}{suffix}{line}\n"


def build_bindings(joystick_id: str) -> dict[str, str]:
    return {
        "command.reinit_joysticks": "keyboard 0x0 21+ctrl+shift+alt",
        "md.input.auto": "0",
        "md.input.port1": "gamepad6",
        "md.input.port1.gamepad.a": f"keyboard 0x0 5 || joystick {joystick_id} button_3",
        "md.input.port1.gamepad.b": f"keyboard 0x0 17 || joystick {joystick_id} button_1",
        "md.input.port1.gamepad.c": f"keyboard 0x0 16 || joystick {joystick_id} button_0",
        "md.input.port1.gamepad.down": f"keyboard 0x0 22 || joystick {joystick_id} button_12",
        "md.input.port1.gamepad.left": f"keyboard 0x0 4 || joystick {joystick_id} button_13",
        "md.input.port1.gamepad.rapid_a": f"keyboard 0x0 10 || joystick {joystick_id} button_2",
        "md.input.port1.gamepad.rapid_b": f"keyboard 0x0 11 || joystick {joystick_id} button_9",
        "md.input.port1.gamepad.rapid_c": f"keyboard 0x0 13 || joystick {joystick_id} button_10",
        "md.input.port1.gamepad.right": f"keyboard 0x0 7 || joystick {joystick_id} button_14",
        "md.input.port1.gamepad.start": f"keyboard 0x0 8 || joystick {joystick_id} button_6",
        "md.input.port1.gamepad.up": f"keyboard 0x0 26 || joystick {joystick_id} button_11",
        "md.input.port1.gamepad6.a": f"keyboard 0x0 5 || joystick {joystick_id} button_3",
        "md.input.port1.gamepad6.b": f"keyboard 0x0 17 || joystick {joystick_id} button_1",
        "md.input.port1.gamepad6.c": f"keyboard 0x0 16 || joystick {joystick_id} button_0",
        "md.input.port1.gamepad6.down": f"keyboard 0x0 22 || joystick {joystick_id} button_12",
        "md.input.port1.gamepad6.left": f"keyboard 0x0 4 || joystick {joystick_id} button_13",
        "md.input.port1.gamepad6.mode": f"keyboard 0x0 24 || joystick {joystick_id} button_4",
        "md.input.port1.gamepad6.rapid_a": f"joystick {joystick_id} button_2",
        "md.input.port1.gamepad6.rapid_b": f"joystick {joystick_id} button_9",
        "md.input.port1.gamepad6.rapid_c": f"joystick {joystick_id} button_10",
        "md.input.port1.gamepad6.rapid_x": "",
        "md.input.port1.gamepad6.rapid_y": "",
        "md.input.port1.gamepad6.rapid_z": "",
        "md.input.port1.gamepad6.right": f"keyboard 0x0 7 || joystick {joystick_id} button_14",
        "md.input.port1.gamepad6.start": f"keyboard 0x0 8 || joystick {joystick_id} button_6",
        "md.input.port1.gamepad6.up": f"keyboard 0x0 26 || joystick {joystick_id} button_11",
        "md.input.port1.gamepad6.x": f"keyboard 0x0 11 || joystick {joystick_id} button_9",
        "md.input.port1.gamepad6.y": f"keyboard 0x0 13 || joystick {joystick_id} button_10",
        "md.input.port1.gamepad6.z": f"keyboard 0x0 14 || joystick {joystick_id} button_2",
        "nes.input.port1": "gamepad",
        "nes.input.port1.gamepad.a": f"keyboard 0x0 16 || joystick {joystick_id} button_1",
        "nes.input.port1.gamepad.b": f"keyboard 0x0 17 || joystick {joystick_id} button_0",
        "nes.input.port1.gamepad.down": f"keyboard 0x0 22 || joystick {joystick_id} button_12",
        "nes.input.port1.gamepad.left": f"keyboard 0x0 4 || joystick {joystick_id} button_13",
        "nes.input.port1.gamepad.rapid_a": f"keyboard 0x0 13 || joystick {joystick_id} button_3",
        "nes.input.port1.gamepad.rapid_b": f"keyboard 0x0 11 || joystick {joystick_id} button_2",
        "nes.input.port1.gamepad.right": f"keyboard 0x0 7 || joystick {joystick_id} button_14",
        "nes.input.port1.gamepad.select": f"keyboard 0x0 20 || joystick {joystick_id} button_4",
        "nes.input.port1.gamepad.start": f"keyboard 0x0 8 || joystick {joystick_id} button_6",
        "nes.input.port1.gamepad.up": f"keyboard 0x0 26 || joystick {joystick_id} button_11",
        "pce.input.port1": "gamepad",
        "pce.input.port1.gamepad.down": f"joystick {joystick_id} button_12 || keyboard 0x0 22",
        "pce.input.port1.gamepad.i": f"joystick {joystick_id} button_1 || keyboard 0x0 11",
        "pce.input.port1.gamepad.ii": f"keyboard 0x0 13 || joystick {joystick_id} button_0",
        "pce.input.port1.gamepad.iii": f"joystick {joystick_id} button_10 || keyboard 0x0 24",
        "pce.input.port1.gamepad.iv": f"keyboard 0x0 24 || joystick {joystick_id} button_10",
        "pce.input.port1.gamepad.left": f"joystick {joystick_id} button_13 || keyboard 0x0 4",
        "pce.input.port1.gamepad.mode_select": f"joystick {joystick_id} button_9 || keyboard 0x0 21",
        "pce.input.port1.gamepad.mode_select.defpos": "2",
        "pce.input.port1.gamepad.rapid_i": f"joystick {joystick_id} button_3 || keyboard 0x0 17",
        "pce.input.port1.gamepad.rapid_ii": f"joystick {joystick_id} button_2 || keyboard 0x0 16",
        "pce.input.port1.gamepad.right": f"joystick {joystick_id} button_14 || keyboard 0x0 7",
        "pce.input.port1.gamepad.run": f"keyboard 0x0 8 || joystick {joystick_id} button_6",
        "pce.input.port1.gamepad.select": f"joystick {joystick_id} button_4 || keyboard 0x0 20",
        "pce.input.port1.gamepad.up": f"joystick {joystick_id} button_11 || keyboard 0x0 26",
        "pce.input.port1.gamepad.v": f"joystick {joystick_id} button_10 || keyboard 0x0 24",
        "pce.input.port1.gamepad.vi": f"joystick {joystick_id} button_10 || keyboard 0x0 24",
        "pce_fast.input.port1": "gamepad",
        "pce_fast.input.port1.gamepad.down": f"keyboard 0x0 22 || joystick {joystick_id} button_12",
        "pce_fast.input.port1.gamepad.i": f"keyboard 0x0 11 || joystick {joystick_id} button_1",
        "pce_fast.input.port1.gamepad.ii": f"keyboard 0x0 13 || joystick {joystick_id} button_0",
        "pce_fast.input.port1.gamepad.iii": f"keyboard 0x0 24 || joystick {joystick_id} button_10",
        "pce_fast.input.port1.gamepad.iv": f"keyboard 0x0 24 || joystick {joystick_id} button_10",
        "pce_fast.input.port1.gamepad.left": f"keyboard 0x0 4 || joystick {joystick_id} button_13",
        "pce_fast.input.port1.gamepad.mode_select": f"keyboard 0x0 21 || joystick {joystick_id} button_9",
        "pce_fast.input.port1.gamepad.mode_select.defpos": "2",
        "pce_fast.input.port1.gamepad.rapid_i": f"keyboard 0x0 17 || joystick {joystick_id} button_3",
        "pce_fast.input.port1.gamepad.rapid_ii": f"keyboard 0x0 16 || joystick {joystick_id} button_2",
        "pce_fast.input.port1.gamepad.right": f"keyboard 0x0 7 || joystick {joystick_id} button_14",
        "pce_fast.input.port1.gamepad.run": f"keyboard 0x0 8 || joystick {joystick_id} button_6",
        "pce_fast.input.port1.gamepad.select": f"keyboard 0x0 20 || joystick {joystick_id} button_4",
        "pce_fast.input.port1.gamepad.up": f"keyboard 0x0 26 || joystick {joystick_id} button_11",
        "pce_fast.input.port1.gamepad.v": f"keyboard 0x0 24 || joystick {joystick_id} button_10",
        "pce_fast.input.port1.gamepad.vi": f"keyboard 0x0 24 || joystick {joystick_id} button_10",
    }


def sync_config() -> tuple[bool, str]:
    if not CFG_PATH.exists():
        return False, f"Mednafen config not found at {CFG_PATH}."

    cfg_text = CFG_PATH.read_text()
    joystick_id = infer_joystick_id(cfg_text)
    if not joystick_id:
        return False, "Could not find an existing Mednafen joystick ID to reuse."

    if not BACKUP_PATH.exists():
        shutil.copy2(CFG_PATH, BACKUP_PATH)

    updated = cfg_text
    for key, value in build_bindings(joystick_id).items():
        updated = set_setting(updated, key, value)

    if updated != cfg_text:
        CFG_PATH.write_text(updated)

    return True, joystick_id


def main(argv: list[str]) -> int:
    sync_only = False
    mednafen_args = list(argv)

    if "--sync-only" in mednafen_args:
        sync_only = True
        mednafen_args.remove("--sync-only")

    if not sync_only and running_mednafen_pids():
        message = (
            "Another Mednafen game is already open. Close it before launching a new "
            "one so controller settings do not get overwritten."
        )
        print(message, file=sys.stderr)
        notify("Mednafen Already Running", message)
        return 1

    ok, details = sync_config()
    if not ok:
        print(f"RetroCore Mednafen sync warning: {details}", file=sys.stderr)
        if sync_only:
            return 1
    elif sync_only:
        print(f"Synced Mednafen controller bindings using {details}.")
        return 0

    if not mednafen_args:
        print("Usage: mednafen_launch.py [mednafen args...]", file=sys.stderr)
        return 2

    bridge = start_bridge(detect_profile(mednafen_args))
    child = subprocess.Popen(["mednafen", *mednafen_args])
    schedule_reinit_hotkeys()
    try:
        return child.wait()
    finally:
        if bridge and bridge.poll() is None:
            bridge.terminate()
            try:
                bridge.wait(timeout=2)
            except subprocess.TimeoutExpired:
                bridge.kill()


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
