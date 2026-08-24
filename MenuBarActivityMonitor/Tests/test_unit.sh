#!/usr/bin/env bash

set -euo pipefail

if swift -e 'import Testing' >/dev/null 2>&1; then
    exec swift test "$@"
fi

# Some Command Line Tools installations ship Testing.framework outside Swift's
# default module and runtime search paths. Add those paths only when necessary.
developer_path="${DEVELOPER_DIR:-$(xcode-select -p)}"
framework_path="$developer_path/Library/Developer/Frameworks"
interop_path="$developer_path/Library/Developer/usr/lib"

if [[ ! -d "$framework_path/Testing.framework" || ! -f "$interop_path/lib_TestingInterop.dylib" ]]; then
    echo "Unable to locate a usable Swift Testing framework." >&2
    exit 1
fi

exec swift test \
    -Xswiftc -F -Xswiftc "$framework_path" \
    -Xlinker -F -Xlinker "$framework_path" \
    -Xlinker -rpath -Xlinker "$framework_path" \
    -Xlinker -rpath -Xlinker "$interop_path" \
    "$@"
