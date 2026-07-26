# 09 — Domain Spec vs. Implementation, and Test Coverage Diff

Two independent comparisons against the domain-derived scenarios in
[07-domain-ball-outcomes.md](./07-domain-ball-outcomes.md) and
[08-domain-context-and-flow-scenarios.md](./08-domain-context-and-flow-scenarios.md):

- **Part A — Behavioral diff**: where the current code (`src/utils/scoring.js`,
  `src/components/Scoring.jsx`, `src/components/ScoringV2.jsx`,
  `src/utils/matchFlow.js`) does something different from what the domain spec expects.
  This is a factual diff, not a bug list — some divergences are reasonable, deliberate
  simplifications for a casual box-cricket app; each is labeled accordingly.
- **Part B — Test coverage diff**: which domain scenarios from docs 07–08, *regardless of
  whether the implementation matches*, currently have no automated test exercising them.

## Part A — Behavioral diff (domain spec vs. actual code)

| # | Domain scenario (doc ref) | Domain-expected | Actual implementation | Verdict |
|---|-----------------------------|---------------------|----------------------------|---------|
| A.1 | Wide with physically-run extra runs (07 §Wide, rows 2.2/2.4) — end-crossing should follow the parity of runs actually run, excluding the automatic penalty | e.g. "2wd" (1 physical run) should cross ends; "4wd" (3 physical runs) should cross ends | `Scoring.jsx`/`ScoringV2.jsx` hardcode `ball.runs = 0` for every wide regardless of the total entered, and `restoreStateFromBalls`/`recordBall` compute rotation from `ball.runs` — so **no wide ever rotates strike, at any total** | **Simplification** — the app doesn't distinguish "penalty-only" wides from "byes-run-off-a-wide"; a scorer has no way to enter extra wide runs as physically-run vs boundary in the first place (there's no such distinction in the extras sheet), so this is a deliberate scope reduction, not an oversight. Worth flagging to the user/product owner rather than treating as a bug to silently fix. |
| A.2 | No-ball, batsman's physical runs determine crossing (07 §No Ball) | Matches — crossing uses `noBallBatsmanRuns` only, excluding the 1-run penalty | Confirmed matching in `Scoring.jsx`/`ScoringV2.jsx` (`swapRunsVal = noBallBatsmanRuns`) | **Match** |
| A.3 | Bye / Leg Bye crossing on run parity (07 §Bye/Leg Bye) | Matches | Confirmed — `extraRuns` field carries the run count for bye/legBye, `runsForSwap` uses it directly | **Match** |
| A.4 | Wicket types other than Run Out should always show 0 completed runs (07 §Wickets, 6.1–6.5), since runs before a non-run-out dismissal are void under the Laws of Cricket | The app's wicket sheet lets a scorer pick 0/1/2/3/4/6 "runs" for **any** dismissal type, including Bowled/Caught/LBW/Stumped/Hit Wicket | **Divergence** — the UI doesn't restrict the runs picker based on dismissal type, so a scorer *can* (incorrectly, per the Laws) record "Caught, 4 runs". This is a data-entry validation gap, not a scoring-math bug — the entered runs are simply added to the team score as if they occurred, which is only strictly correct for Run Out (and, rarely, Stumped-with-a-bye, out of scope). Worth a product decision on whether to restrict the runs picker per dismissal type. |
| A.5 | Run Out — whether the batsmen had crossed at the moment of the throw determines which end the incoming batsman occupies and whether the run counts at all (07 §Wickets, 6.6b/6.6c) | Domain rule depends on a "had they crossed" fact independent of the completed-run count | The app only takes a flat "runs completed" number and a separate "who is out" (striker/non-striker) picker — it doesn't model "crossed or not" as a distinct fact. The crossing used for placing the incoming batsman is derived purely from the parity of the entered runs (`runsForRotation % 2`) | **Simplification** — in the overwhelming majority of real run-out scenarios the entered "runs completed" and "who's out" together produce the same placement outcome as tracking crossing explicitly, but a scorer could construct a run-out shape (e.g. "0 runs, non-striker out, but they'd actually already crossed") that the app can't represent. Reasonable for a casual scoring app; a competitive-scoring app would need a "had crossed" toggle. |
| A.5b | Byes and leg-byes are debited to the batting team but **not** to the bowler's runs (Laws of Cricket; 07 §Bye/Leg Bye "runs unchanged" for the bowler) | Bowler's conceded runs should not increase on a bye/leg-bye | `scoring.js:74` does `bowlers[bowlKey].runs += totalRuns` **unconditionally**, so byes and leg-byes **are** added to the bowler's conceded runs | **Divergence** — the bowler's economy/runs figure is inflated by byes and leg-byes. For a casual box-cricket app this is a minor inaccuracy, but it is a genuine departure from standard scoring and affects the bowling card's R and Econ columns. Worth a product decision (fix by excluding bye/legBye from the bowler-runs accumulation, or accept and document). |
| A.6 | Bowler-credited dismissals include only Bowled/Caught/LBW/Stumped/Hit Wicket (07 in-scope UI types) | Matches — `BOWLER_CREDITED_DISMISSALS` set in `scoring.js` is exactly these five | Confirmed match | **Match** |
| A.7 | Engine-only dismissal types (`retired hurt`, `obstructing the field`, `timed out`) that doc 07 explicitly scoped out of UI-driven scenarios | Not reachable from the UI | Confirmed — `Scoring.jsx`/`ScoringV2.jsx` wicket sheets only offer the 6 in-scope types; the other 3 strings only appear in `scoring.js`'s credit-matrix, presumably as data-import/legacy compatibility, not a live scoring path | **Match with doc 07's scoping** — correctly out of reach in the UI as expected |
| A.8 | End-of-over swap fires unconditionally on the 6th legal ball, even with a wicket on that ball (08 §1.3) | Matches | Confirmed in `recordBall`: the over-end swap block runs after the wicket-driven placement, unconditionally on `legalBalls % 6 === 0` | **Match** |
| A.9 | Innings/match ends immediately on the triggering ball, even mid-over (08 §1.4/1.5) | Matches | Confirmed — `recordBall` recomputes all-out/overs-complete/target-chased after every single ball and short-circuits into the innings-break or `endMatch` path immediately, never waiting for the over to finish | **Match** |
| A.10 | Reaching exactly the target does not end the match on its own (08 §1.5) | Matches | Confirmed — `newTargetChased` requires strict `>` | **Match** |
| A.11 | v2 requires explicit bowler confirmation at the over boundary (08 §2.1) | Matches, when `forceBowlerEachOver` setting is on | Confirmed via `matchFlow.js`'s `needsBowlerAtBoundary` gating the `bowler` in-play step | **Match** (setting-gated, as expected) |
| A.12 | v1 supports editing any earlier ball in the current over; v2 does not need to (08 §2.5) | v1: yes. v2: no stated expectation | Confirmed — `Scoring.jsx` has an `editBall` sheet; `ScoringV2.jsx` has no equivalent, relying on undo/redo instead | **Match** |
| A.13 | Both modes support mid-match team-size/overs reconfiguration (08 §2.6) — doc 08 scoped this as a v1 expectation, not a v2 one | v1: yes (`Change Team Sizes`/`Change Overs` menu items). v2: not expected | Confirmed — v2's menu has **only** "View Scorecard" and "Home"; no team-size or overs reconfiguration exists in v2 at all | **Match with doc 08's scoping** — this was called out as v1-only in the domain doc precisely because v2's real feature set doesn't offer it |
| A.14 | Team-size decrease guarded against contradicting current wicket count (08 §3.2) | Matches | Confirmed — v1's `saveTeamSizes` clamps to `wickets + 2` for the batting team | **Match** (v1 only, per A.13) |
| A.15 | Overs decrease guarded against overs already effectively bowled (08 §3.4) | Matches, with a specific rounding rule: a *partial* over already bowled still consumes a full over's worth of the minimum | Confirmed — v1's `saveOvers` clamps to `Math.ceil(legalBalls / 6)`, so 7 legal balls (1 ball into over 2) requires a minimum of 2 overs, not 1 | **Match**, with the rounding detail worth calling out explicitly in a test case (a naive implementer might reach for `Math.floor` or a plain division and get it wrong) |

## Part B — Test coverage diff (domain scenarios with no automated test, regardless of Part A verdict)

| # | Domain scenario (doc ref) | Coverage status |
|---|-----------------------------|----------------------|
| B.1 | Wide totals broken down by physical-run parity (07 §Wide, all rows) | ❌ No test exercises multiple wide totals distinctly — `scoring.test.js` covers "wide 7" as a single aggregation case, not a parity/rotation matrix across wide values |
| B.2 | No-ball with each of 0/1/2/4/6 batsman runs, individually asserting rotation (07 §No Ball) | ⚠️ Partial — boundary-off-no-ball and basic no-ball cases exist; a full 0/1/2/4/6 rotation matrix isn't enumerated |
| B.3 | Bye/Leg-bye at every run value 1–4, individually asserting rotation (07 §Bye/Leg Bye) | ⚠️ Partial — bye/leg-bye legality and extras totals are tested; not a full per-value rotation matrix |
| B.3b | Bye/leg-bye should NOT be charged to the bowler's runs (A.5b divergence) | ❌ No test asserts the bowler's runs are unaffected by a bye/leg-bye — the current (divergent) behavior is unverified either way |
| B.4 | Non-run-out wicket types entered with non-zero "runs" (A.4's divergence) | ❌ No test — since the UI doesn't restrict this, there's no assertion of what happens when it's misused this way (worth adding once/if a product decision is made on A.4) |
| B.5 | Run-out placement scenarios distinguishing "crossed vs. not crossed" outcomes (A.5) | ❌ Not applicable as stated (the app doesn't model this fact), but the *achievable* run-out placement scenarios (striker out vs. non-striker out, at 0/1/2/3 completed runs) are only partially enumerated in `scoring.test.js` |
| B.6 | Wicket + end-of-over coincidence for every dismissal type (not just the general case) (08 §1.3) | ⚠️ Partial — `restoreStateFromBalls` tests cover a run-out crossing an over boundary; not all six dismissal types × over-boundary combination |
| B.7 | Innings/match-ending mid-over for every triggering combination (all-out mid-over, overs-complete mid-over, target-exceeded mid-over) (08 §1.4/1.5) | ⚠️ Partial — component tests (`Scoring.test.jsx`/`ScoringV2.test.jsx`) cover innings/match completion, but not systematically for "mid-over" vs "on the last ball" as separate cases |
| B.8 | Team-size increase mid-innings recalculating the all-out threshold on the very next ball (08 §3.1) | ❌ No test found asserting the threshold recomputation timing (immediate vs. stale) |
| B.9 | Overs increase mid-innings recalculating the overs-complete threshold on the very next ball (08 §3.3) | ❌ No test found for the increase direction (decrease + `Math.ceil` clamp is tested per doc 05/A.15, increase is not) |
| B.10 | Settings changed mid-match not retroactively altering already-recorded balls (08 §3.5) | ❌ No test found |
| B.11 | v2 redo after undo, then diverging with a new ball, invalidating stale redo history (already flagged as a gap in doc 03 §4.6) | ❌ No test |

## How to use this document

- Items marked **Simplification** or **Divergence** in Part A are candidates for a product
  conversation (fix the code, restrict the UI, or explicitly accept and document the
  limitation) — they are not automatically bugs.
- Items in Part B are candidates for new automated tests, independent of whether Part A
  flags a mismatch for the same scenario — a scenario can be both "implemented as the app
  intends" and "untested."
