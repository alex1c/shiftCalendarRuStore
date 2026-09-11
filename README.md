# Мой график смен

Офлайн-календарь рабочих графиков для Android / RuStore (ForestMusic).

Приложение помогает сразу видеть, рабочий выбранный день или выходной,
по повторяющемуся циклу смен — без облака, аккаунта и рекламы.

Internal name: **Shift Calendar**

## Repository

| Role | Path / URL |
| --- | --- |
| Remote Cursor | `D:\PetProject\shiftCalendarRuStore` |
| Local Codex + AVD | `D:\petProject\shiftCalendarRuStore` |
| GitHub (source of truth) | https://github.com/alex1c/shiftCalendarRuStore |
| Default branch | `main` |
| Android package | `com.calculatorplatform.shiftcalendar` |
| Display name | Мой график смен |
| Version | `1.0.0` (versionCode `1`) |

**GitHub is the source of truth.** Sync both machines through `origin/main`.

## Two-computer workflow

1. Finish work on Cursor (`D:\PetProject\shiftCalendarRuStore`).
2. Commit and push to `origin/main`.
3. On the Codex machine (`D:\petProject\shiftCalendarRuStore`): `git pull origin main`.
4. Run checks locally and review on a light AVD before the next phase.

Do not put machine-specific paths into runtime application code.

## Current status

**Phase 10 — Backup / restore** is implemented.

Users can export a versioned JSON backup of profiles, overrides, active
profile, salary settings and notification settings, then share the file
through the system sheet. Restore validates and previews the file, asks
for destructive confirmation, then atomically replaces local data and
rebuilds shift reminders for the restored primary profile.

## Stack

- Expo SDK 57
- React Native 0.86
- React 19
- TypeScript (strict)
- React Navigation (stack + bottom tabs)
- AsyncStorage (versioned JSON, sequential access)
- expo-notifications (local DATE triggers, not push / FCM)
- expo-file-system / expo-sharing / expo-document-picker
- Jest + ESLint
- Android-first / RuStore

## Main commands

```bash
npm install
npm start
npm run android
npm test
npm run typecheck
npm run lint
npm run doctor
```

Requires Node.js >= 20.19.4.

## Architecture

```
src/
  components/     UI primitives (calendar grid, chips, screen shell)
  screens/        Onboarding, calendar, today, more, notifications, backup
  navigation/     Root stack, tabs, nested more stack
  domain/         Cycle engine, civil dates, salary, notifications, backup
  backup/         File export/import + restore orchestration
  notifications/  Native adapter (permissions, channel, schedule)
  storage/        AsyncStorage repository
  theme/          Light/dark tokens
  utils/          Ids
  types/          Domain model types
  features/       App bootstrap / persisted schedule
```

UI never walks dates to compute a shift. The cycle engine uses
`day difference + positive modulo` on `YYYY-MM-DD` civil dates.

## Backup

- Format: versioned JSON (`backupVersion: 1`, app id =
  `com.calculatorplatform.shiftcalendar`)
- Includes: profiles (+ schedules, shift types, overrides, notes),
  activeProfileId, salarySettings, notificationSettings
- Excludes: pending native notification ids, Expo/dev transient data
- Filename: `Moi_grafik_smen_backup_YYYY-MM-DD_HH-mm.json`
- Restore: migrate → validate → prepare → atomic `multiSet` replace
- After restore: `rescheduleShiftNotifications` for the primary profile
- Confirmation required before destructive replace

## Notifications

Local shift reminders (Phase 9) remain primary-profile only. After a
restore, pending reminders are cancelled and rebuilt from restored
settings. Real-device notification QA is still required before release.

## Release blockers

### NOTIFICATION REAL DEVICE QA (required before release)

On a real Android device, verify permission, delivery with the app closed,
reboot behavior, battery optimization, gesture / 3-button navigation, and
notification appearance.

## Roadmap

- P0 Foundation
- P1 Onboarding + presets + basic calendar
- P2 Custom cycle builder
- P3 Calendar UX
- P4 Day overrides / отпуск / больничный / переработка
- P5 Today
- P6 Statistics
- P7 Salary
- P8 Multiple schedules
- P9 Notifications
- P10 Backup / Restore
- P11 Share / PDF
- P12 Widget
- P13 Learning
- P14 UX polish / real-device bottom safe-area audit
- P15 Ads + AppMetrica
- P16 Release

## Out of scope for this phase

Cloud sync, Google Drive auto-backup, encryption/password backups, exact
alarms, alarm clock, secondary-profile notifications, FCM / push,
Firebase, widget, PDF, ads, AppMetrica, production signing.
