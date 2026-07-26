#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_URL="http://localhost:3055"
CHROME_APP="$HOME/Applications/Chrome Apps.localized/RetroCore Emulator Launcher.app"

# Apps opened from the Dock do not inherit the shell's Homebrew PATH.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if ! /usr/bin/curl --fail --silent "$SERVER_URL/api/ping" >/dev/null 2>&1; then
  NODE_BIN="$(command -v node 2>/dev/null)"
  if [ -z "$NODE_BIN" ] && [ -x /opt/homebrew/bin/node ]; then
    NODE_BIN=/opt/homebrew/bin/node
  fi

  if [ -z "$NODE_BIN" ]; then
    /usr/bin/osascript -e 'display alert "RetroCore could not start" message "Node.js was not found. Install Node.js with Homebrew and try again." as critical'
    exit 1
  fi

  /usr/bin/nohup "$NODE_BIN" "$SCRIPT_DIR/server/index.js" >/tmp/retrocore.log 2>&1 &

  attempts=0
  until /usr/bin/curl --fail --silent "$SERVER_URL/api/ping" >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 50 ]; then
      /usr/bin/osascript -e 'display alert "RetroCore could not start" message "The server did not respond. See /tmp/retrocore.log for details." as critical'
      exit 1
    fi
    sleep 0.1
  done
fi

if [ -d "$CHROME_APP" ]; then
  /usr/bin/open -a "$CHROME_APP"
else
  /usr/bin/open "$SERVER_URL"
fi
