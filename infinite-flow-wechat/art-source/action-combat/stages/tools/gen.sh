#!/bin/zsh
# Drive Codex CLI built-in image_gen for one chapter stage background.
# Usage: gen.sh <run-name> <prompt-file> <transparent:true|false> [reference-image ...]
# Logs + Codex reply go to /tmp/if-action/stages/gen/<run-name>.*  (outside the repo).
# stdin is always /dev/null (codex exec otherwise blocks reading stdin) and the run is
# killed after 600 s.
set -u
name="$1"; promptfile="$2"; transparent="$3"; shift 3
out=/tmp/if-action/stages/gen
mkdir -p "$out"
prompt="$(cat "$promptfile")"
refs=""
for r in "$@"; do refs="$refs
- $r"; done
if [ -n "$refs" ]; then
  refline="Pass these local files to the image tool as referenced images (references, not edit targets):$refs"
else
  refline="Do not pass any reference images."
fi
if [ "$transparent" = "true" ]; then
  bgline="Request a genuinely transparent background (transparent_background=true); keep the real alpha."
else
  bgline="Opaque output (transparent_background=false)."
fi
wrapper="Use your built-in image generation tool (image_gen) exactly once to generate ONE new image. Do not use the CLI fallback or any API script, do not write or modify any files, do not post-process, and do not run shell commands except read-only commands to locate the generated file.
$bgline
$refline
Use the prompt between the markers verbatim as the image prompt:
<<<PROMPT
$prompt
PROMPT>>>
After generating, reply with: (1) the absolute path of the generated PNG under ~/.codex/generated_images, (2) the exact tool arguments you passed as JSON (everything except the prompt text), (3) the pixel dimensions."
cd "$out"
codex exec --skip-git-repo-check -C "$out" -s read-only \
  -c model_reasoning_effort='"medium"' \
  --json -o "$out/$name.last.txt" "$wrapper" \
  < /dev/null > "$out/$name.events.jsonl" 2> "$out/$name.stderr.txt" &
pid=$!
( sleep 600; if kill -0 $pid 2>/dev/null; then echo "killed after 600s" > "$out/$name.timeout"; pkill -TERM -P $pid; kill -TERM $pid; fi ) &
wd=$!
wait $pid; rc=$?
pkill -P $wd 2>/dev/null; kill $wd 2>/dev/null
echo "[$name] exit=$rc"
[ -f "$out/$name.timeout" ] && cat "$out/$name.timeout"
[ -f "$out/$name.last.txt" ] && grep -oE '/Users/[^ `"]*generated_images/[^ `"]*\.png' "$out/$name.last.txt" | head -1
exit $rc
