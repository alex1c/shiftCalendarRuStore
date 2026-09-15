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

**Release polish — обучение и discoverability** is implemented.

«Ещё → Обучение» is a full scrollable in-app guide (график, календарь,
ручные дни, графики семьи, совместный календарь, PDF, сегодня, статистика,
зарплата, уведомления, резервная копия). Calendar share is a labeled
«Поделиться» action; «Совместный» uses an icon+label chip. One-shot hints
cover the second profile and delayed share discoverability.

Phase 12 Ads + AppMetrica remain available.

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
- yandex-mobile-ads (РСЯ)
- @appmetrica/react-native-analytics (optional key)
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
  learning/      In-app tutorial catalogue + discovery hints
  ads/            Yandex Mobile Ads config, session policy, banners
  analytics/      AppMetrica wrapper + privacy-safe events
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

## Ads + analytics

- SDK: `yandex-mobile-ads` + `@appmetrica/react-native-analytics`
- AppMetrica application ID: `6355141`
- Banners: Calendar / Statistics / More (not Today above the fold)
- Interstitial: max 1×/session, delayed start, blocked in protected flows
- Rewarded: ID stored only; no Phase 12 UI
- Dev mode: official Yandex demo units + logging
- AppMetrica: configured through the project extra config
- Events never include salary amounts, notes, names, dates, or backup bodies

## Backup

- Format: versioned JSON (`backupVersion: 1`)
- Full replace restore with confirmation
- Notification reschedule after restore

## Release blockers

Real-device QA on OPPO already passed (safe area, notifications, backup,
PDF, AppMetrica, ads). Remaining before store: RuStore assets / privacy
copy / release signing.

## Roadmap

- P0–P12: foundation → ads/analytics
- Release polish: обучение + discoverability (this phase)
- Next: RuStore assets / privacy / release prep
- Deferred: widget, image export, cloud sync

## Out of scope for this phase

Image export, widget, cloud sync, range vacation editor, production
signing, new large product features.
