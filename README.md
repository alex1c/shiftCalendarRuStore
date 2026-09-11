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

**Phase 11 — Calendar PDF sharing** is implemented.

From the calendar header, users can share the **visible month** as a local
PDF (single active profile or combined two-profile view). The PDF uses
effective days (overrides included), a Monday-first grid, Russian labels,
legend, month summary and optional common days off. Generation is
`expo-print` HTML → PDF; delivery is the system share sheet.

Image export is deferred.

## Stack

- Expo SDK 57
- React Native 0.86
- React 19
- TypeScript (strict)
- React Navigation (stack + bottom tabs)
- AsyncStorage (versioned JSON, sequential access)
- expo-notifications (local DATE triggers, not push / FCM)
- expo-file-system / expo-sharing / expo-document-picker
- expo-print (HTML → PDF)
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
  domain/         Cycle engine, civil dates, salary, notifications, backup, export
  export/         Calendar PDF HTML + print/share service
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

## Calendar PDF

- Entry: Calendar header share → PDF
- Page: A4 landscape, light document theme
- Data: effective days for the visible month only
- Modes: single active profile, or combined (max 2)
- Filename examples:
  - `Moi_grafik_smen_2026-09.pdf`
  - `Moi_grafik_smen_marina_2026-09.pdf`
  - `Moi_grafik_smen_combined_ya_marina_2026-09.pdf`
- Salary and day notes are not included
- Image share: deferred

## Backup

- Format: versioned JSON (`backupVersion: 1`)
- Full replace restore with confirmation
- Notification reschedule after restore

## Release blockers

### NOTIFICATION REAL DEVICE QA (required before release)

Permission, delivery while closed, reboot, battery optimization, navigation
modes, appearance.

### BACKUP FULL MUTATION PROOF

Deferred full device roundtrip remains part of final real-device QA.

### BOTTOM SAFE-AREA AUDIT

Real-device bottom inset audit remains later.

## Roadmap

- P0–P10: foundation → backup
- P11 Calendar PDF share
- P12 Widget
- P13 Learning polish
- P14 UX polish / real-device bottom safe-area audit
- P15 Ads + AppMetrica
- P16 Release

## Out of scope for this phase

Image export, payroll PDF, yearly/multi-month reports, cloud share, email
sending, widget, ads, AppMetrica, production signing.
