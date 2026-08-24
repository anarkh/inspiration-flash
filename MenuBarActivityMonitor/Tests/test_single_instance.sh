#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_EXECUTABLE="$PROJECT_DIR/.build/release/MenuBarActivityMonitor"

first_pid=""
second_pid=""
restart_pid=""
left_pid=""
right_pid=""

cleanup() {
    for candidate_pid in "$first_pid" "$second_pid" "$restart_pid" "$left_pid" "$right_pid"; do
        if [[ -n "$candidate_pid" ]] && kill -0 "$candidate_pid" 2>/dev/null; then
            kill -TERM "$candidate_pid" 2>/dev/null || true
            wait "$candidate_pid" 2>/dev/null || true
        fi
    done
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

cd "$PROJECT_DIR"
swift build -c release

"$APP_EXECUTABLE" >/dev/null 2>&1 &
first_pid=$!
sleep 1
if ! kill -0 "$first_pid" 2>/dev/null; then
    wait "$first_pid" || true
    echo "FAIL: the first test instance exited. Quit any running MenuBar Activity Monitor instance and retry." >&2
    exit 1
fi

"$APP_EXECUTABLE" >/dev/null 2>&1 &
second_pid=$!
sleep 1
if kill -0 "$second_pid" 2>/dev/null; then
    echo "FAIL: a sequential duplicate remained alive." >&2
    exit 1
fi
wait "$second_pid"
second_pid=""
kill -0 "$first_pid"
echo "PASS: a sequential duplicate exited while the first instance remained alive."

kill -TERM "$first_pid"
wait "$first_pid" || true
first_pid=""

"$APP_EXECUTABLE" >/dev/null 2>&1 &
restart_pid=$!
sleep 1
if ! kill -0 "$restart_pid" 2>/dev/null; then
    echo "FAIL: restart after lock release did not remain alive." >&2
    exit 1
fi
echo "PASS: a new instance started after the previous owner released the lock."
kill -KILL "$restart_pid"
wait "$restart_pid" 2>/dev/null || true
restart_pid=""

"$APP_EXECUTABLE" >/dev/null 2>&1 &
restart_pid=$!
sleep 1
if ! kill -0 "$restart_pid" 2>/dev/null; then
    echo "FAIL: restart after SIGKILL did not remain alive." >&2
    exit 1
fi
echo "PASS: SIGKILL released the kernel lock despite the persistent lock file."
kill -TERM "$restart_pid"
wait "$restart_pid" || true
restart_pid=""

"$APP_EXECUTABLE" >/dev/null 2>&1 &
left_pid=$!
"$APP_EXECUTABLE" >/dev/null 2>&1 &
right_pid=$!
sleep 1

alive_count=0
survivor_pid=""
for candidate_pid in "$left_pid" "$right_pid"; do
    if kill -0 "$candidate_pid" 2>/dev/null; then
        alive_count=$((alive_count + 1))
        survivor_pid="$candidate_pid"
    else
        wait "$candidate_pid"
    fi
done

if [[ "$alive_count" -ne 1 ]]; then
    echo "FAIL: concurrent launch left $alive_count instances; expected exactly one." >&2
    exit 1
fi
echo "PASS: concurrent launch kept exactly one instance."

kill -TERM "$survivor_pid"
wait "$survivor_pid" || true
left_pid=""
right_pid=""
trap - EXIT INT TERM
