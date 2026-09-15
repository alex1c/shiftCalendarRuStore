# Release checklist — Мой график смен

Package: `com.calculatorplatform.shiftcalendar`  
Display name: Мой график смен  
Developer: ForestMusic

## Quality gates

- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run doctor` (expo-doctor)

## Real device / runtime

- [ ] Cold start on real device
- [ ] Gesture navigation safe-area
- [ ] Notification scheduling
- [ ] Notification delivery
- [ ] Backup create + restore roundtrip
- [ ] PDF share
- [ ] AppMetrica events (privacy-filtered)
- [ ] Ads runtime (banners / rare interstitial policy)

## Store assets

- [ ] Privacy URL live: https://alex1c.github.io/shiftCalendarRuStore/privacy.html
- [ ] Master icon integrated (`assets/icon_gpt.png`)
- [ ] Launcher icon visual QA on device/AVD
- [ ] Screenshots 1080×1920 (01–08 per `docs/SCREENSHOT_PLAN.md`)
- [ ] Short description (`docs/rustore-listing.md`)
- [ ] Full description
- [ ] What’s new
- [ ] Category/tags chosen on RuStore upload screen

## Build / signing (local release phase)

- [ ] Version `1.0.0` confirmed (or bump if required)
- [ ] `versionCode` confirmed
- [ ] Package name confirmed
- [ ] Production signing (local machine only; never invent passwords here)
- [ ] Production AAB built locally
- [ ] Bundle verification
- [ ] SHA256 recorded
- [ ] RuStore upload

## Deferred 1.1 (not release blockers)

- Widget
- Image export
- Cloud sync
