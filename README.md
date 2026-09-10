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

**Phase 6 — Statistics tab** is implemented.

The Статистика screen totals effective days for 7/30/90 days, the current
month, the current year, or startDate→today: work shifts and hours,
day/night/other, offs, vacation, sick, day-off, extra shifts, overtime.

## Stack

- Expo SDK 57
- React Native 0.86
- React 19
- TypeScript (strict)
- React Navigation (stack + bottom tabs)
- AsyncStorage (versioned JSON, sequential access)
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
  screens/        Onboarding, calendar, placeholders, more
  navigation/     Root stack, tabs, nested more stack
  domain/         Shift types, presets, cycle engine, civil dates
  storage/        AsyncStorage repository
  theme/          Light/dark tokens
  utils/          Ids
  types/          Domain model types
  features/       App bootstrap / persisted schedule
```

UI never walks dates to compute a shift. The cycle engine uses
`day difference + positive modulo` on `YYYY-MM-DD` civil dates.

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
- P10 Widget
- P11 Share / PDF
- P12 Backup / Restore
- P13 Learning
- P14 UX polish
- P15 Ads + AppMetrica
- P16 Release

## Out of scope for this phase

Salary, extra profiles, family mode, PDF, share image, backup ZIP,
restore, РСЯ, AppMetrica, production signing, widget, alarms,
rich notifications, internet holidays, cloud sync, range vacation editor.
