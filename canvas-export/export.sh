#!/usr/bin/env bash
# Re-export everything: regenerate Canvas Pages + QTI quizzes, then zip each quiz.
# Usage:  bash export.sh [BASE_URL]
#   BASE_URL (optional): public URL where the interactive-readings folder is hosted,
#   used only for the .embed.html iframe pages.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
node build-canvas.js "$@"
cd "$DIR/out/quizzes"
n=0
for d in */; do
  d="${d%/}"
  rm -f "$d.zip"
  ( cd "$d" && zip -qr "../$d.zip" . )
  n=$((n+1))
done
echo "Zipped $n quiz packages into out/quizzes/"

# Whole-course package: one Canvas-native .imscc that imports all Pages + quizzes
# + numbered/ordered Modules. Built in Python (needs ZIP_STORED + strict layout).
cd "$DIR"
if [ -n "$1" ]; then
  # A BASE_URL was given: pages are hosted, so embed the LIVE interactive readings.
  python3 build-cartridge.py --embed
else
  # No host: static prose pages + separate graded quiz.
  python3 build-cartridge.py
fi
