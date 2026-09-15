# Мой график смен

Офлайн-календарь рабочих графиков для Android / RuStore (ForestMusic).

Приложение помогает сразу видеть, рабочий выбранный день или выходной,
по повторяющемуся циклу смен — без облака и аккаунта.

Internal engineering name: **shift-calendar** (not shown in store UI).

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
| Developer | ForestMusic · https://forest-music.ru |
| Contact | rustore-alex1c@yandex.ru |

**GitHub is the source of truth.** Sync both machines through `origin/main`.

## Two-computer workflow

1. Finish work on Cursor (`D:\PetProject\shiftCalendarRuStore`).
2. Commit and push to `origin/main`.
3. On the Codex machine (`D:\petProject\shiftCalendarRuStore`): `git pull origin main`.
4. Run checks locally and review on a light AVD before the next phase.

Do not put machine-specific paths into runtime application code.

## Current status

**Phase 15 — RuStore assets / privacy / icon / release metadata prep.**

- Master icon: `assets/icon_gpt.png` (official release asset)
- Privacy page prepared: `docs/privacy.html`
- RuStore listing texts: `docs/rustore-listing.md`
- Screenshot plan: `docs/SCREENSHOT_PLAN.md`
- Release checklist: `docs/RELEASE_CHECKLIST.md`

Expected privacy URL (Pages):  
https://alex1c.github.io/shiftCalendarRuStore/privacy.html  
Status: **PREPARED** (not verified live in this phase).

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
- @appmetrica/react-native-analytics
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
  learning/       In-app tutorial catalogue + discovery hints
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
docs/
  privacy.html           Privacy policy (GitHub Pages)
  index.html             App landing for Pages
  rustore-listing.md     Short/full/what's new texts
  SCREENSHOT_PLAN.md     1080×1920 frame plan
  RELEASE_CHECKLIST.md   Release gate checklist
```

UI never walks dates to compute a shift. The cycle engine uses
`day difference + positive modulo` on `YYYY-MM-DD` civil dates.

## Icon

- Master: `assets/icon_gpt.png` (1254×1254)
- Expo / Android icon: master path
- Adaptive foreground: `assets/icon-adaptive-foreground.png`
  (master with exterior near-black fill replaced by brand blue `#1D98FE`
  to reduce double-mask gaps; artwork itself is not redrawn)
- Adaptive backgroundColor: `#1D98FE`

## Ads + analytics

- SDK: `yandex-mobile-ads` + `@appmetrica/react-native-analytics`
- AppMetrica application id: `6355141` (API key in `app.json` extra; not published in privacy text)
- Banners: Calendar / Statistics / More
- Interstitial: max 1×/session, delayed start, blocked in protected flows
- Rewarded: ID stored only; not shown in UI
- Events never include salary amounts, notes, names, dates, or backup bodies

## Calendar PDF

- Entry: Calendar → Поделиться → PDF
- Page: A4 landscape
- Footer: «Мой график смен» • RuStore (`RUSTORE_APP_URL` still null)
- Image share: deferred

## Backup

- Format: versioned JSON (`backupVersion: 1`)
- Full replace restore with confirmation
- Notification reschedule after restore

## Release prep

See `docs/RELEASE_CHECKLIST.md`. Production signing and AAB are local-only
and are not performed in this Cursor phase.

## Deferred 1.1

- Widget
- Image export
- Cloud sync

## Out of scope for this phase

Production signing, production keystore/password invention, production AAB,
widget, image export, cloud sync, new product features.
