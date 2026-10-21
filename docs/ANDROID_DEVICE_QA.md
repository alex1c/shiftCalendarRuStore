# Android Device QA — Мой график смен (ForestMusic standard)

USB + Metro `8081` playbook for real-device debugging with Expo Dev Client.

## Quick start

```powershell
.\scripts\android-device-qa.ps1
```

На Windows **не вводите URL вручную**. Скрипт сам:

1. поднимает Metro с `NODE_OPTIONS=--dns-result-order=ipv4first` (не затирая другие флаги);
2. ждёт **HTTP** `http://127.0.0.1:8081/status` → `packager-status:running` (QR **не** считается готовностью);
3. делает `adb reverse tcp:8081 tcp:8081`;
4. открывает Dev Client deep link с явным `url=http://127.0.0.1:8081`;
5. пишет диагностический лог в `tmp/android-device-qa-*.log`;
6. пропускает Gradle `assembleDebug`, если существующий debug APK не старше watched native-входов.

## Почему нужен IPv4-first

На Windows Expo Metro часто слушает только `::1:8081`.  
Dev Client ходит на `127.0.0.1:8081` → TCP/HTTP на IPv4 падает, на экране остаётся пустой **Development Build** без адреса проекта.

Проверка:

```powershell
Get-NetTCPConnection -LocalPort 8081 -State Listen
Invoke-WebRequest http://127.0.0.1:8081/status -UseBasicParsing
```

Если listener только `::1`, а `/status` на `127.0.0.1` не отвечает — остановите старый Metro и запустите этот скрипт снова.

## Options

| Command | Purpose |
|--------|---------|
| `.\scripts\android-device-qa.ps1` | Auto-skip or build, install, IPv4 Metro, reverse, deep link |
| `.\scripts\android-device-qa.ps1 -SkipBuild` | Force reuse of existing debug APK |
| `.\scripts\android-device-qa.ps1 -AppMetricaLog` | + filtered logcat |
| `.\scripts\android-device-qa.ps1 -Logcat` | + full PID logcat |
| `.\scripts\android-device-qa.ps1 -ClearMetroCache` | Metro `--clear` (only if cache proven broken) |
| `.\scripts\android-device-qa.ps1 -DeviceSerial <serial>` | Multi-device pick |
| `.\scripts\android-device-qa.ps1 -DryRun` | Planned commands only |
| `.\scripts\android-device-qa.ps1 -SelfTest` | Offline assertions (NODE_OPTIONS, deep link, IPv6/port/phone scenarios) |
| `.\scripts\tests\android-device-qa.selftest.ps1` | Wrapper around `-SelfTest` |
| `.\scripts\android-device-qa.ps1 -SkipGitPullPrompt` | No git pull question |

## Rules (ForestMusic)

- **Metro always port 8081.** Never auto-switch to 8082/8083.
- **Do not start a second Metro** if `http://127.0.0.1:8081/status` already returns `packager-status:running`.
- **USB QA = `adb reverse` + `127.0.0.1`**, never LAN IP, never `expo a` alone.
- Deep link format:

  `exp+shift-calendar://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081`

- Occupied 8081 is killed only after explicit `Y` (or when IPv6-only / unhealthy).
- No `gradlew clean`, `prebuild --clean`, `npm ci`, force git ops, AVD launch.
- `dumpsys` version check after install is mandatory.
- Native freshness watch: `android/app/src`, `android/app/build.gradle`, root Gradle files, `app.json`, `package.json`.

## Copying to another ForestMusic app

Edit only `$Config` in `scripts/android-device-qa.ps1`:

- `Package`
- `Scheme` (Expo slug for `exp+<slug>://`)
- `MetroPort` (keep `8081`)
- `ApkPath`
