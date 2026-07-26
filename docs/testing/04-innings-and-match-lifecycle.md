# 04 — Innings & Match Lifecycle

Covers innings-completion triggers, target/chase logic, result generation, and
resuming in-progress matches. Logic lives in `Scoring.jsx` / `ScoringV2.jsx`
(`isInningsOver`, `endMatch`) built on top of `scoring.js`.

See [README.md](./README.md) for the status legend.

## Innings-over triggers

`battingPlayerCount = max(players.length, teamSize)`, all-out = `wickets >= battingPlayerCount - 1` (last-man rule — last batsman plays on with no partner).

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 1.1 | All out before overs complete (`wickets >= battingPlayerCount - 1`) | Innings ends immediately, even mid-over | ✅ |
| 1.2 | Overs complete with wickets in hand | Innings ends at `legalBalls >= totalOvers * 6` | ✅ |
| 1.3 | Last wicket falls on the exact final legal ball of the innings | Both triggers coincide — verify no double-processing/duplicate innings-break screen | ⚠️ |
| 1.4 | Team size = 2 (minimum), last-man rule with only 1 wicket possible | All-out at `wickets >= 1` — verify degenerate case doesn't break "last man batting alone" logic | ❌ |
| 1.5 | `players.length` differs from `teamSize` (e.g. only 4 named players but team size set to 6) | `battingPlayerCount` uses the max of the two — verify wicket threshold uses the *effective* size, not just named players | ❌ |

## Innings break

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 2.1 | End of innings 1 | Innings-break screen shown, target = `firstInningsScore + 1` | ✅ |
| 2.2 | Target displayed with 0 first-innings runs (all-out for a duck) | Target = 1 | ⚠️ |
| 2.3 | "Start 2nd Innings" tapped | Roles swap (bowling team now bats), fresh striker/non-striker/bowler selection (or startup flow in v2) | ✅ |

## Target chased (innings 2 only)

`targetChased = innings===2 && firstInningsScore != null && score.runs > firstInningsScore` (strict greater-than).

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 3.1 | Chasing team's runs strictly exceed target mid-over | Match ends immediately at that ball — no further balls needed even mid-over | ✅ |
| 3.2 | Chasing team's runs reach *exactly* the target (tie score) | Match does **not** auto-end via `targetChased` (strict `>`, not `>=`) — innings continues until all-out or overs complete | ✅ |
| 3.3 | Chasing team reaches exact tie AND that was the last ball of the innings/last wicket | Innings ends via the all-out/overs-complete trigger, result = "Match Tied" | ⚠️ |
| 3.4 | Winning boundary hit that overshoots target by a large margin (e.g. needed 1, hits a 6) | Full runs recorded even though only 1 was "needed"; match still ends at that ball | ⚠️ |
| 3.5 | Chasing team is all out exactly on the target score (not exceeding it) | Result = "Match Tied", not a win — since `targetChased` requires strictly greater | ⚠️ |

## Result string generation (`endMatch`)

| # | Scenario | Expected string pattern | Status |
|---|----------|---------------------------|--------|
| 4.1 | Innings 1 ends (match somehow stops after 1 innings — edge case) | `"{team} scored R/W"` | ⚠️ |
| 4.2 | Chasing team wins with wickets in hand | `"{chasing team} won by {battingPlayerCount-1-wickets} wicket(s)"` | ✅ |
| 4.3 | Chasing team wins by exactly 1 wicket (last-man stand chase) | `"... won by 1 wicket"` (singular wording — verify grammar) | ⚠️ |
| 4.4 | Chasing team wins with all wickets in hand (0 lost) | `"... won by {battingPlayerCount-1} wickets"` | ⚠️ |
| 4.5 | Defending team wins (chase falls short, all out or overs run out below target) | `"{first team} won by {-diff} run(s)"` | ✅ |
| 4.6 | Defending team wins by exactly 1 run | `"... won by 1 run"` (singular wording) | ⚠️ |
| 4.7 | Scores level (`diff === 0`) | `"Match Tied"` | ✅ |
| 4.8 | Win by 0 runs | Not reachable — a `diff` of exactly 0 always routes to "Match Tied", never "won by 0 runs" | 🚫 |

## Resume in-progress match

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 5.1 | Resume a `live` v1 match mid-over | Score, striker/non-striker, bowler, extras all correctly rebuilt from ball history via `restoreStateFromBalls` | ✅ |
| 5.2 | Resume a `live` v2 match mid-`StartupFlow` (toss done, openings not yet picked) | Resumes exactly at the startup step left off | ✅ |
| 5.3 | Resume a `live` match that's in the innings-break screen (innings 1 done, innings 2 not started) | Innings-break screen shown again on resume, not innings 1 or a blank innings 2 | ⚠️ |
| 5.4 | Resume a `completed` match | Opens directly to Scorecard/result, not the live scoring screen | ✅ |
| 5.5 | Resume after app was closed mid-wicket-sheet (unsaved sheet state) | Sheet state is not persisted — resumes to the last *saved* ball, in-progress sheet input is lost (expected, since sheets aren't saved until confirmed) | ⚠️ |

## Explicit non-features (verify absence, not presence)

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 6.1 | Tied match at the end of a limited-overs game | No super-over prompt offered anywhere in the UI | 🚫 |
| 6.2 | Match interrupted by "rain" (no such feature) | No DLS-adjusted target calculation exists | 🚫 |
| 6.3 | One bowler bowls every over of an innings | No enforcement/warning against exceeding a per-bowler over limit | 🚫 |
