---
name: box-cricket-architecture
description: Architecture, data-model, deployment, and sync/import-export reference for the Box Cricket scoring PWA. Use this when making bug fixes or enhancements to this app — to understand the Dexie/IndexedDB data model, the "ball log is the source of truth" state model (score/striker/bowler are re-derived, never stored), the v1 vs v2 scoring flows, screen routing in App.jsx, PWA + GitHub Pages deployment, or the JSON sync/export format and how to extend it to online sync.
---

# Box Cricket — Architecture & Design Reference

A React 19 + Vite offline-first PWA for scoring box cricket. Data lives in the browser
(IndexedDB via Dexie); there is no backend. Read this file first, then open the specific
reference below for the area you're changing.

## The one invariant that governs everything

**The ball log is the single source of truth.** Every derived value — team score, wickets,
each batsman's runs/balls, bowler figures, who is on strike, which over it is — is
*recomputed* from the ordered list of ball records, never stored as a mutable running total.

- Score/stats come from `calculateScore(balls)` (`src/utils/scoring.js`).
- Striker/non-striker/bowler come from `restoreStateFromBalls(balls)` (same file).
- **Undo** = delete the last ball, then re-derive. **Edit** = update/replace a ball, then
  re-derive. **Resume after reload** = replay the whole log to rebuild live state.

Consequence for changes: if you touch scoring behavior, change it in the pure functions and
let the UI re-derive — do **not** add a parallel mutable counter in a component. If a bug
shows a wrong score, suspect the derivation or the stored ball shape, not a stale total.

## Layer map (where things live)

| Layer | Files | Responsibility |
|---|---|---|
| Entry / shell | `src/main.jsx`, `src/App.jsx` | Mount; screen routing via a `screen` state string; theme; import/export orchestration. No React Router — navigation is state. |
| Screens (UI) | `src/components/*.jsx` | `MatchList`, `NewMatch`, `Scoring` (v1), `ScoringV2` (guided), `Scorecard`, `Settings`, plus shared pieces (`MiniScorebar`, `BallLog`, `FlowOverlay`, `StartupFlow`, `PlayerPicker`, `RunOptions`, `DragList`, `Icon`). |
| Domain logic (pure) | `src/utils/scoring.js`, `src/utils/matchFlow.js` | Framework-free scoring math and v2 in-play step sequencing. 100%-ish unit tested. |
| Persistence | `src/db.js` | Dexie schema + all match/ball/audit CRUD and the sync-field helpers. |
| Sync / transfer | `src/utils/sync.js`, `src/utils/debug.js` | JSON export/import (matches+balls) and the v2 debug-log export (audit). |
| Config | `src/settings.js` (guided-scoring toggles, localStorage), `vite.config.js` (PWA + base path). |

## Reference documents

- **[references/architecture.md](references/architecture.md)** — layered architecture,
  component/screen map, the re-derivation data flow, v1-vs-v2 split, state & navigation
  model, with diagrams.
- **[references/data-model.md](references/data-model.md)** — Dexie schema, the match / ball /
  auditLog entities and every field (incl. sync fields), the ER diagram, and the
  backward-compatibility conventions.
- **[references/deployment.md](references/deployment.md)** — local dev, Vite build, the PWA /
  service-worker behavior, and the CI + GitHub Pages deploy pipeline.
- **[references/sync-import-export.md](references/sync-import-export.md)** — the sync file
  format, export scopes, the import/conflict/merge flow, the identity model, and a concrete
  plan for extending to **online sync** in future.

## Conventions to honor when changing this app (from CLAUDE.md)

- **New work on a branch off `main`; open a PR.** Never push to `main` directly.
- **Tests are mandatory**: `npm test` must be 100% green and `npm run test:coverage` ≥ 80%
  statements before pushing. Every feature/fix/refactor ships with tests.
- **Backward compatibility via `??` fallbacks** for new fields (e.g.
  `match.teamASize ?? match.playersPerSide`). Do not add IndexedDB migrations for
  non-indexed fields — just default them when read.
- **Extras/runs pickers** use the `[preset values] + "+" custom-input` pattern.

## Related references already in the repo

- `docs/testing/` — exhaustive test-scenario catalog (config, scoring engine, UI flows,
  lifecycle, data management, and anchor-based ball-outcome scenarios). Consult it when a
  change could affect scoring correctness; it also flags known domain-vs-implementation
  divergences (e.g. byes/leg-byes charged to the bowler, wides never rotating strike).
