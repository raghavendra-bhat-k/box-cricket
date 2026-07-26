# Box Cricket App — Test Scenario Catalog

This is a QA/test-planning reference cataloging test scenarios across the Box Cricket
scoring PWA. Docs 01–06 are derived from a read of the current source
(`src/utils/scoring.js`, `src/db.js`, and all `src/components/*.jsx`) plus the existing
automated test suite. Docs 07–09 take a different, complementary approach: they define
ball-level scenarios purely from standard cricket scoring domain rules (scoped to this
app's feature set), independent of what the code currently does, then separately diff that
domain spec against the actual implementation and against test coverage.

It is **not** itself a test suite — it's a checklist for manual exploratory testing,
regression planning, and identifying automated-test gaps.

## Status legend

| Tag | Meaning |
|-----|---------|
| ✅  | Covered by an existing automated test (file noted) |
| ⚠️  | Partially covered — some cases tested, related edge cases are not |
| ❌  | No automated test coverage found (gap) |
| 🚫  | Explicit non-feature — the app does not do this; scenario confirms it correctly does *not* happen |

## Documents

1. [01-match-configuration.md](./01-match-configuration.md) — `NewMatch.jsx`: team setup, overs/players limits, custom scoring rules, rematch, tournament grouping
2. [02-scoring-engine.md](./02-scoring-engine.md) — `src/utils/scoring.js`: pure scoring/aggregation/strike-rotation logic
3. [03-scoring-ui-workflows.md](./03-scoring-ui-workflows.md) — `Scoring.jsx` (v1) and `ScoringV2.jsx` (guided) live scoring screens
4. [04-innings-and-match-lifecycle.md](./04-innings-and-match-lifecycle.md) — innings completion, target/chase, results, resume
5. [05-match-list-and-data-management.md](./05-match-list-and-data-management.md) — `MatchList.jsx`, Dexie schema, sync/export/import
6. [06-scorecard-sharing-and-pwa.md](./06-scorecard-sharing-and-pwa.md) — `Scorecard.jsx` display/sharing, PWA/offline behavior
7. [07-domain-ball-outcomes.md](./07-domain-ball-outcomes.md) — anchor-based, implementation-independent before/after state: a fixed anchor state with every possible ball outcome enumerated, re-anchored at each position (first ball, last ball of over/innings/match)
8. [08-domain-context-and-flow-scenarios.md](./08-domain-context-and-flow-scenarios.md) — the version and settings axes layered on top of doc 07's anchors: v1 vs v2 app-version expectations and mid-match settings changes
9. [09-domain-vs-implementation-diff.md](./09-domain-vs-implementation-diff.md) — Part A: where the actual code diverges from the domain spec (docs 07–08), labeled simplification vs. divergence; Part B: which domain scenarios have no automated test, independent of Part A

## Known app-wide non-features (do not test as bugs)

- No DLS / rain-adjusted targets
- No super over or other tie-breaker — a tied match simply displays **"Match Tied"**
- No per-bowler maximum-overs cap/enforcement
- No online/offline indicator in the UI (app is offline-first via service worker, but has no connectivity banner)
