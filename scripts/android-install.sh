#!/usr/bin/env bash
# Build the debug APK and install it on a device WITHOUT ever uninstalling.
#
# `cap run android` (native-run) uninstalls the app when Android refuses an
# update (a different signing key, or a lower version) and installs again,
# which silently deletes every project on the device. This script uses
# `adb install -r`, which keeps the app's data, and stops instead.
#
# Usage: ANDROID_TARGET=<serial or ip:port> scripts/android-install.sh
# (run `npm run android:sync` first; `npm run android:run` does both).
set -euo pipefail

APP_ID=com.hayesmaker64.c64pad
APK=android/app/build/outputs/apk/debug/app-debug.apk
cd "$(dirname "$0")/.."

target=()
if [[ -n "${ANDROID_TARGET:-}" ]]; then
  target=(-s "$ANDROID_TARGET")
  # Wireless targets: (re)connect, harmless if already connected.
  if [[ "$ANDROID_TARGET" == *:* ]]; then
    adb connect "$ANDROID_TARGET" >/dev/null || true
  fi
fi

(cd android && ./gradlew --quiet assembleDebug)

echo "Installing $APK ${ANDROID_TARGET:+on $ANDROID_TARGET}…"
if ! output=$(adb "${target[@]}" install -r "$APK" 2>&1); then
  echo "$output" >&2
  if [[ "$output" == *INSTALL_FAILED_UPDATE_INCOMPATIBLE* ]]; then
    cat >&2 <<'EOF'

The app on the device was signed with a different key (e.g. built on another
computer before android/app/debug.keystore was shared). Installing over it
needs an uninstall, which DELETES ALL PROJECTS on the device.

Not uninstalling. To go ahead:
  1. Export every project you want to keep (My Projects → ⋮ → Export).
  2. adb uninstall com.hayesmaker64.c64pad
  3. Run this again, then import the projects.
EOF
  elif [[ "$output" == *INSTALL_FAILED_VERSION_DOWNGRADE* ]]; then
    echo >&2
    echo "The device has a newer versionCode; not downgrading (that would wipe its projects)." >&2
  fi
  exit 1
fi

adb "${target[@]}" shell am start -n "$APP_ID/.MainActivity" >/dev/null
echo "Installed and started $APP_ID; its projects were kept."
