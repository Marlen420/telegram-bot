#!/bin/sh
set -eu

SRC="${1:-./videos}"
OUT="${2:-./videos}"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required but not installed" >&2
  exit 1
fi

mkdir -p "$OUT"

for file in "$SRC"/*; do
  [ -f "$file" ] || continue

  case "$file" in
    *.MOV | *.mov | *.mp4 | *.MP4) ;;
    *) continue ;;
  esac

  base=$(basename "$file" | sed 's/\.[^.]*$//')
  output="$OUT/${base}.mp4"
  tmp="$OUT/${base}.tmp.mp4"

  echo "Optimizing: $file -> $output"

  # FFmpeg applies rotation metadata automatically, keeping original resolution.
  ffmpeg -y -hide_banner -loglevel error -i "$file" \
    -f mp4 \
    -c:v libx264 -crf 27 -preset medium \
    -c:a aac -b:a 128k -ac 2 \
    -movflags +faststart \
    -pix_fmt yuv420p \
    "$tmp"

  mv "$tmp" "$output"
done

echo "Done."
