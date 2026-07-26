# 06 — Scorecard, Sharing & PWA (`Scorecard.jsx`, `vite.config.js`, `utils/sync.js`)

See [README.md](./README.md) for the status legend.

## Scorecard display

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 1.1 | Batting table columns | Batsman, How Out, R, B, 4s, 6s | ✅ |
| 1.2 | Bowling table columns | Bowler, O, R, W, Econ (economy = runs/overs, `.toFixed(1)`) | ✅ |
| 1.3 | Extras line | Total extras + breakdown (W, NB, B, LB) | ✅ |
| 1.4 | Section order respects toss (v2 matches) | `match.toss.battingFirst` determines which team's innings displays first | ✅ |
| 1.5 | v1 match (no `toss` field) | Falls back to default/implicit order | ⚠️ |
| 1.6 | Result banner | Shows the `endMatch`-generated result string | ✅ |
| 1.7 | 2nd-innings display while match is still live (mid-chase) | Shows partial 2nd-innings batting/bowling alongside completed 1st innings | ✅ |
| 1.8 | Ball-by-ball toggle | Renders `BallLog` (ball, event, score, batter, bowler columns; end-of-over summary rows) | ✅ |
| 1.9 | Fall-of-wickets display | **Does not exist** — Scorecard has no FOW section | ❌ (gap — not implemented, not just untested) |
| 1.10 | Run-rate display on the Scorecard itself | **Does not exist** on the printed card — RR only lives in `MiniScorebar` during live scoring | ❌ (gap — not implemented) |

## Sharing

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 2.1 | "Share on WhatsApp" | Opens `wa.me/?text=<formatted scorecard>` | ✅ |
| 2.2 | "Copy / Share" where `navigator.share` is available (mobile) | Native share sheet invoked with formatted text | ✅ |
| 2.3 | "Copy / Share" where `navigator.share` unavailable but `navigator.clipboard.writeText` is | Copies formatted text to clipboard | ✅ |
| 2.4 | "Copy / Share" where neither API is available (very old browser) | Falls back to a hidden textarea + `execCommand('copy')` | ✅ |
| 2.5 | "Share Match Sync File" | Triggers `onShareSync`, using `navigator.canShare`/`navigator.share` with file attachment where supported | ✅ |
| 2.6 | `generateShareText` output formatting | Verify readable plain-text layout across varying team-name lengths and score sizes | ⚠️ |
| 2.7 | Image export of the scorecard | **Does not exist** — no such feature in the codebase | 🚫 |

## PWA / offline behavior

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 3.1 | First load, service worker registers | Workbox precaches build assets (`registerType: 'autoUpdate'`) | ⚠️ |
| 3.2 | Load app fully offline after first successful visit | App shell + assets served from cache; IndexedDB data available (Dexie is local-first) | ⚠️ |
| 3.3 | New deploy while app is open | `autoUpdate` silently updates the service worker on next load — no user-facing "update available" prompt (`useRegisterSW`/needRefresh not wired up) | ❌ (gap — behavior exists via Workbox default but isn't surfaced to the user, and isn't tested) |
| 3.4 | Install as PWA (Add to Home Screen) | Manifest specifies standalone display, portrait orientation, theme color `#1a472a`, `start_url: /box-cricket/`, 192/512 icons | ⚠️ |
| 3.5 | Status bar / theme-color sync with app palette | Confirmed by `App.test.jsx` | ✅ |
| 3.6 | Explicit online/offline indicator in the UI | **Does not exist** — `navigator.onLine` is unused anywhere in the app | 🚫 |
| 3.7 | Score a match fully offline, then come back online and export/share a sync file | Should work seamlessly since scoring never depends on network; sync/share is a manual user-triggered action, not automatic | ⚠️ |

## Known display/feature gaps (explicit, not bugs to "fix" without a product decision)

- No fall-of-wickets section on the Scorecard (1.9)
- No run-rate shown on the printed Scorecard (1.10)
- No update-available prompt when a new version is deployed while the app is open (3.3)
- No online/offline connectivity indicator anywhere in the UI (3.6)
- `MatchList` has no search or filter control beyond tournament/day grouping (see doc 05)
