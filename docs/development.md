# Developing C64-Pad

Notes for working on C64-Pad itself. For using the app, see the
[user guide](userguide/README.md).

## Running locally

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
```

## Testing

```bash
npm test             # unit tests (Vitest): the C64 model, encoders, importers
npm run test:e2e     # browser tests (Playwright, Chromium) in e2e/
npm run test:e2e:ui  # the same, in Playwright's UI mode
```

The browser tests start their own dev server on port 3100 (or reuse one already
running there), so `npm run dev` on 3000 can stay open. The first time, install
the browser with `npx playwright install chromium`. CI runs both suites.

## Linting & formatting

```bash
npm run lint
npm run format
npm run check
```

## Running on an Android device

Builds the web app, syncs it into `android/` and installs a debug build.

```zsh
adb devices -l                                  # find the device serial / ip:port
ANDROID_TARGET=192.168.0.34:5555 npm run android:run
```

Without `ANDROID_TARGET`, adb uses the only connected device (it stops if
there are several).

**Your projects are safe across installs.** `android:run` installs with
`adb install -r`, which keeps the app's data. It never uninstalls: if the
device's copy was signed with a different key, it stops and explains instead
(uninstalling deletes every project on the device). Debug builds are signed
with `android/app/debug.keystore`, which is committed, so every computer and
Android Studio sign the same way. It's a standard debug key, never for release.

Over USB, no IP is needed: use the serial from `adb devices -l` as the target
(e.g. `ANDROID_TARGET=PDNP06J000033459`).

**Linux: "no permissions (missing udev rules?)"** means adb can see the device
but your user can't open it. Find the vendor ID with `lsusb` (`19d2` for
ZTE/RedMagic), add a rule, then replug and accept "Allow USB debugging?" on
the tablet (your user must be in `plugdev`):

```zsh
echo 'SUBSYSTEM=="usb", ATTR{idVendor}=="19d2", MODE="0660", GROUP="plugdev"' \
  | sudo tee /etc/udev/rules.d/51-android.rules
sudo udevadm control --reload-rules && sudo udevadm trigger
```

Wireless adb via a one-off USB connection (works on any Android):

```zsh
adb shell ip -f inet addr show wlan0 | grep inet  # the tablet's IP (or Settings → About → Status)
adb tcpip 5555 && adb connect <tablet-ip>:5555   # then unplug
```

"Connection refused" straight after `adb tcpip` just means the tablet's adb
hadn't restarted yet: run `adb connect <tablet-ip>:5555` again.

TCP mode lasts until the tablet reboots.
