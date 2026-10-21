# Dependency / security classification (Phase 1 remediation)

Generated for Codex re-audit. **No mass `npm audit fix`. No Expo/RN/Yandex/AppMetrica upgrades in this change.**

## A. Expo package patch mismatches (7)

From `npx expo-doctor` (SDK 57 expected vs installed):

| Package | Expected | Found |
|---------|----------|-------|
| expo | ~57.0.31 | 57.0.24 |
| expo-dev-client | ~57.0.20 | 57.0.19 |
| expo-document-picker | ~57.0.3 | 57.0.2 |
| expo-notifications | ~57.0.23 | 57.0.20 |
| expo-sharing | ~57.0.24 | 57.0.21 |
| expo-splash-screen | ~57.0.10 | 57.0.9 |
| jest-expo | ~57.0.6 | 57.0.5 |

**Applicability:** toolchain / SDK alignment, not a known production exploit by itself.  
**Minimal safe fix (later release train):** `npx expo install --fix` in a dedicated dependency PR with full regression QA. Deferred here by release policy.

## B. npm audit summary

Observed during remediation: **75** advisories (metadata): moderate 14, high 60, critical 1.  
(Codex earlier cited ~52 — counts drift with lockfile; treat current `npm audit` as source of truth.)

Most highs are transitive through **Jest**, **Metro/Expo CLI**, and **react-native** tooling graphs. Fixes often propose major Expo/Jest downgrades/upgrades that are unsafe as a blanket action.

## C. Critical advisory

| Field | Value |
|-------|-------|
| Package | `shell-quote@1.10.0` |
| Advisory | GHSA-pqg4-j6r4-53mv — `quote()` command injection |
| Severity | critical |
| Range | `>=1.8.4 <1.11.0` |
| Dependency path | `react-native` → `react-devtools-core` → `shell-quote` and `@react-native-community/cli` → `cli-tools` → `launch-editor` → `shell-quote` |
| Production Android AAB | **Not applicable** — DevTools / CLI editor helpers are not packaged into the RuStore release AAB runtime |
| Exploitable in store build? | **No evidence** of inclusion in production app binary path |
| Minimal safe fix | Prefer RN/Expo-aligned bump that pulls `shell-quote@>=1.11.0`, or a narrowly scoped `overrides` entry **after** CI proof; do not mass-audit-fix |

**Status impact:** does **not** keep release BLOCKED for production exploitability. Remains tracked as tooling debt.

## D. High — direct / notable production-adjacent

| Package | Path / note | Prod Android? | Minimal fix |
|---------|-------------|---------------|-------------|
| `react-native` (high, transitive) | Root runtime; advisories mostly CLI/Metro/Jest preset graph | Runtime present; specific CVEs need case-by-case | Stay on Expo 57 pin; upgrade only via Expo SDK train |
| `@appmetrica/react-native-analytics` (high via `react-native`) | Direct prod SDK | Yes (analytics) | Do not downgrade to 3.x (audit suggestion); wait for AppMetrica+RN-compatible release |
| `expo` / `@expo/cli` / metro packages (high) | Dev client + build tooling | Mostly build-time; Dev Client is debug | `expo install --fix` in dedicated PR |
| `jest*` (many highs) | DevDependency only | No | Jest 30 major later; not release-blocking |

## E. Decision

No confirmed **production-exploitable critical** issue in the RuStore AAB path from the critical `shell-quote` finding. Proceed with Codex re-audit of code fixes; schedule dependency train separately.
