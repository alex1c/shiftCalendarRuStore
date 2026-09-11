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

**Phase 9 — Shift notifications** is implemented.

Users can opt into local reminders for the **primary** schedule only
(default OFF). Offsets: 24h / 12h / 2h / 1h / custom (15 minutes … 7 days),
at most two at once. The planner uses effective days (overrides, extra
shifts, custom work, overnight) and rebuilds a 30-day window after launch
or a schedule / override / settings save.

Permission is requested only after the user enables reminders.
Android channel: «Напоминания о сменах». Exact alarms and alarm-clock
behavior are out of scope.

## Stack

- Expo SDK 57
- React Native 0.86
- React 19
- TypeScript (strict)
- React Navigation (stack + bottom tabs)
- AsyncStorage (versioned JSON, sequential access)
- expo-notifications (local DATE triggers, not push / FCM)
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
  screens/        Onboarding, calendar, today, more, notifications
  navigation/     Root stack, tabs, nested more stack
  domain/         Cycle engine, civil dates, salary, notification plan
  notifications/  Native adapter (permissions, channel, schedule)
  storage/        AsyncStorage repository
  theme/          Light/dark tokens
  utils/          Ids
  types/          Domain model types
  features/       App bootstrap / persisted schedule
```

UI never walks dates to compute a shift. The cycle engine uses
`day difference + positive modulo` on `YYYY-MM-DD` civil dates.

Reminder copy and trigger instants come from the pure function
`buildNotificationPlan`. `NotificationService` is the only module that
imports `expo-notifications`.

## Notifications

- Settings key: `@shiftcalendar/notifications`
- Default: disabled, one 1-hour offset stored for when the user opts in
- Planning window: next 30 civil days, primary profile only
- Identifiers: `shift_reminder_{profileId}_{YYYY-MM-DD}_{offsetMinutes}`
- Permission status is read from the OS, never stored as source of truth
- Reschedule on app launch (non-blocking) and after primary schedule /
  override / notification-settings saves
- Secondary profile edits do not rebuild primary reminders

### Expo Go

Local scheduled notifications remain available in Expo Go on SDK 57.
Push / remote notifications are not. Do not treat Expo Go as proof of
delivery while the app is killed.

### Reboot

Phase 9 does **not** guarantee that pending reminders survive a device
reboot. Settings persist, and the next app launch rebuilds the 30-day
plan when reminders are enabled and permission is granted.

## Release blockers

### NOTIFICATION REAL DEVICE QA (required before release)

On a real Android device, verify:

- POST_NOTIFICATIONS permission (grant / deny / open settings)
- Delivery while the app is closed
- Behavior after reboot (expect rebuild on next launch, not silent restore)
- Battery optimization / OEM background limits
- Gesture navigation and 3-button navigation
- Actual notification appearance (title, body, channel, dark shade)
- Vacation / extra-shift reschedule after an override save
- Overnight shifts and previous-day 12h reminders on the device clock

This checkpoint is independent of Expo Go / AVD smoke tests.

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
- P14 UX polish / real-device bottom safe-area audit
- P15 Ads + AppMetrica
- P16 Release

## Out of scope for this phase

Exact alarms, alarm clock, secondary-profile notifications, FCM / push,
Firebase, widget, PDF, share, backup ZIP, restore, ads, AppMetrica,
production signing, internet holidays, cloud sync.
