# Changelog — 1.0.2 (versionCode 3)

## RuStore «Что нового»

- Исправлено отображение рекламных баннеров на экранах Календарь, Сегодня и Статистика: баннер закреплён внизу экрана и больше не уезжает при прокрутке.
- Улучшена повторная загрузка баннера после ошибки / no-fill при возврате на экран (без бесконечных запросов).
- Стабилизирован USB-запуск отладочной сборки на Windows (Metro по IPv4).

## Internal

- Sticky banners via `Screen.footer` outside ScrollView.
- Focus-session policy for banner retries.
- Production sticky unit: `R-M-20020358-3` (demo units only in `__DEV__`).
- Android QA launcher hardened for IPv4 / Metro identity / deep link.
