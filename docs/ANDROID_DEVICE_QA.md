# Android Device QA — Мой график смен

USB + Metro `8081` playbook for real-device debugging with Expo Dev Client.

## Quick start

```powershell
.\scripts\android-device-qa.ps1
```

## Options

| Command | Purpose |
|--------|---------|
| `.\scripts\android-device-qa.ps1` | Build debug APK, install, Metro 8081, `adb reverse`, open Dev Client |
| `.\scripts\android-device-qa.ps1 -AppMetricaLog` | Same, then PID-filtered logcat for AppMetrica / ReactNativeJS |
| `.\scripts\android-device-qa.ps1 -Logcat` | Same, then full PID-filtered logcat |
| `.\scripts\android-device-qa.ps1 -ClearMetroCache` | Metro with `--clear` (only when Metro cache is proven broken) |
| `.\scripts\android-device-qa.ps1 -DeviceSerial <serial>` | Pick device when several are connected |
| `.\scripts\android-device-qa.ps1 -DryRun` | Safe checks + planned commands only (no build/install/kill) |
| `.\scripts\android-device-qa.ps1 -SkipGitPullPrompt` | Do not ask about `git pull` |

## Rules

- **Metro always uses port 8081.** The script never auto-switches to 8082/8083.
- **USB QA uses `adb reverse tcp:8081 tcp:8081`.**
- **Dev Client opens via localhost**, not LAN IP and not `expo a`:

  `exp+shift-calendar://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081`

- **`dumpsys` version check is mandatory** after install (`versionName` / `versionCode` must match `app.json` and `android/app/build.gradle`).
- Occupied 8081 is **not** killed without an explicit `Y` confirmation.
- No `gradlew clean`, `prebuild --clean`, `npm ci`, cache wipes, git reset/stash, or AVD launch.

## What the script does

1. Shows git branch / HEAD / short status (optional `git pull --ff-only` only if tracked tree is clean).
2. Verifies Android SDK under `%LOCALAPPDATA%\Android\Sdk` and `android/local.properties` (creates locally if missing; never commits it).
3. Selects a single `adb` device (`device` status).
4. Ensures Metro port 8081 is free (prompt before kill).
5. Confirms version consistency, runs `assembleDebug`, installs APK, verifies dumpsys.
6. Starts Metro in a **new** PowerShell window (`--dev-client --localhost --port 8081`).
7. Waits for `127.0.0.1:8081`, sets `adb reverse`, opens the Dev Client deep link, prints PID.

## Copying to another ForestMusic app

Edit only the `$Config` block at the top of `scripts/android-device-qa.ps1`:

- `Package`
- `Scheme` (Expo slug for `exp+<slug>://`)
- `MetroPort` (keep `8081`)
- `ApkPath`
