#!/bin/bash
cd "$(dirname "$0")/server"

# Start the server in the background (Terminal has Full Disk Access, so this works)
node index.js > /tmp/retrocore.log 2>&1 &

# Brief wait to allow the server to bind to port
sleep 1

# Open the RetroCore PWA
open "http://localhost:3055"

# Close this Terminal window silently
osascript -e 'tell application "Terminal" to close (every window whose name contains "StartRetroCore")' &>/dev/null
