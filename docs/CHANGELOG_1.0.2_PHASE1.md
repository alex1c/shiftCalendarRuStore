# Changelog draft — Phase 1 (pre-bump)

Target next store version: **1.0.2** (versionCode TBD at release build).  
This Phase 1 commit does **not** bump `app.json` / `android/app/build.gradle`.

## RuStore «Что нового» (черновик)

- Исправлено отображение рекламных баннеров на экранах Календарь, Сегодня и Статистика: баннер закреплён внизу экрана и больше не уезжает за пределы видимой области при прокрутке.
- Улучшена повторная загрузка баннера после временной ошибки сети / no-fill при возврате на экран.
- Стабилизирован USB-запуск отладочной сборки на Windows (Metro по IPv4 + автоматический deep link).

## Internal notes

### Banner root cause

Sticky banners were rendered **inside** `Screen`’s `ScrollView`, so on Calendar / Today / Stats they scrolled off-screen. «Ещё» still showed fill because that screen was short enough for the in-scroll banner to remain visible. Separately, placements `-1` / `-2` / `-4` returned no-fill on device QA while `-3` filled, so main sticky placements temporarily share `R-M-20020358-3` (no new cabinet IDs).

### Not in this phase

- No version bump
- No production AAB
- No Expo / Yandex Ads / AppMetrica dependency upgrades
