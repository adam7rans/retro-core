set baseDir to do shell script "dirname " & quoted form of POSIX path of (path to me)
do shell script "cd " & quoted form of (baseDir & "/server") & " && /opt/homebrew/bin/node index.js > /tmp/retrocore.log 2>&1 &"
do shell script "open 'http://localhost:3055'"
