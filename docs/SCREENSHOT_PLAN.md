# RuStore screenshot plan — Мой график смен

## Final store resolution

- Size: **1080×1920**
- Aspect: **9:16**
- Do **not** upload raw OPPO 1080×2400 captures without crop/letterbox processing.

Preferred capture pipeline (local Codex):

- AVD `ForestMusic_Fast_API35` with display override **1080×1920**
- Release/dev build without demo/test ad labels when possible
- Do not Photoshop the app UI; do not show permission system dialogs

## Planned frames

| File | Frame | Content |
| --- | --- | --- |
| `01-calendar.png` | Главный календарь | September 2026 month grid, day/night/off visible |
| `02-today.png` | Сегодня | Current shift + next shift |
| `03-edit-day.png` | Изменить день | Vacation / extra shift editor (no personal notes) |
| `04-statistics.png` | Статистика | Shifts + hours for a period |
| `05-salary.png` | Зарплата | Neutral demo rates, estimate only |
| `06-family.png` | Совместный | Я + Марина, legend, common days off |
| `07-notifications.png` | Уведомления | Reminder settings (no system permission sheet) |
| `08-share-backup.png` | Share / backup | Stronger of: share PDF entry or backup screen |

## Deterministic demo state

Profiles:

- `Я`
- `Марина`

Month focus: **September 2026**

Show:

- day / night / off cycle
- one vacation day
- one extra shift
- statistics with non-personal numbers
- salary with neutral demo values
- common days off in combined mode

Do **not** use real personal notes or real household data.

## Ads on screenshots

Prefer frames without demo/test advertising labels.

Do not remove Ads architecture for screenshots. If a release/dev build leaves banner area empty when no fill, use that clean layout.
