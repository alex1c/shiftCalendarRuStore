# Android Device QA — Мой график смен (ForestMusic standard)

USB + Metro `8081` playbook for real-device debugging with Expo Dev Client.

## Quick start

```powershell
.\scripts\android-device-qa.ps1
```

На Windows **не вводите URL вручную**. Скрипт сам:

1. проверяет Node engines (Expo 57 / RN 0.86);
2. поднимает Metro с `NODE_OPTIONS=--dns-result-order=ipv4first` (не затирая другие флаги);
3. ждёт **HTTP** `http://127.0.0.1:8081/status` → `packager-status:running` (QR **не** считается готовностью);
4. проверяет, что процесс на 8081 принадлежит **этому** проекту (PID + command line / parents); иначе BLOCKED без kill;
5. всегда выполняет инкрементальный `assembleDebug` (timestamps не считаются доказательством актуальности; `-SkipBuild` — только явный opt-out);
6. делает `adb reverse tcp:8081 tcp:8081`;
7. открывает Dev Client deep link и проверяет вывод `am start` + intent в activity dump (PID приложения сам по себе не доказательство);
8. пишет диагностический лог в `tmp/android-device-qa-*.log`.

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
| `.\scripts\android-device-qa.ps1` | Incremental assembleDebug, install, IPv4 Metro, reverse, deep link |
| `.\scripts\android-device-qa.ps1 -SkipBuild` | Explicit reuse of existing debug APK (staleness risk accepted) |
| `.\scripts\android-device-qa.ps1 -AppMetricaLog` | + filtered logcat |
| `.\scripts\android-device-qa.ps1 -Logcat` | + full PID logcat |
| `.\scripts\android-device-qa.ps1 -ClearMetroCache` | Metro `--clear` (only if cache proven broken) |
| `.\scripts\android-device-qa.ps1 -DeviceSerial <serial>` | Multi-device pick |
| `.\scripts\android-device-qa.ps1 -DryRun` | Planned commands only |
| `.\scripts\android-device-qa.ps1 -SelfTest` | Offline assertions (NODE_OPTIONS, Metro identity, am start, Node engines) |
| `.\scripts\tests\android-device-qa.selftest.ps1` | Wrapper around `-SelfTest` |
| `.\scripts\android-device-qa.ps1 -SkipGitPullPrompt` | No git pull question |

## Rules (ForestMusic)

- **Metro always port 8081.** Never auto-switch to 8082/8083.
- **Do not start a second Metro** if `http://127.0.0.1:8081/status` already returns `packager-status:running` **and** the listener belongs to this repo.
- **Foreign Metro on 8081 → BLOCKED.** Do not auto-kill foreign processes.
- **USB QA = `adb reverse` + `127.0.0.1`**, never LAN IP, never `expo a` alone.
- Deep link format:

  `exp+shift-calendar://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081`

- Occupied 8081 is killed only after explicit `Y` (or when IPv6-only / unhealthy **and** confirmed).
- No `gradlew clean`, `prebuild --clean`, `npm ci`, force git ops, AVD launch.
- `dumpsys` version check after install is mandatory.

## Copying to another ForestMusic app

Edit only `$Config` in `scripts/android-device-qa.ps1`:

- `Package`
- `Scheme` (Expo slug for `exp+<slug>://`)
- `MetroPort` (keep `8081`)
- `ApkPath`
