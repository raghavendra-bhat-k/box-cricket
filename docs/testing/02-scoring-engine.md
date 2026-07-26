# 02 — Scoring Engine (`src/utils/scoring.js`)

Pure, DB-free logic. This is the most heavily unit-tested area of the app
(`scoring.test.js`) — this doc catalogs the full scenario space and flags the
untested edges.

See [README.md](./README.md) for the status legend.

## `calculateScore(balls)` — runs/extras aggregation matrix

| # | Ball type | Legal ball? | Team runs | Batsman credit | Bowler runs | Status |
|---|-----------|-------------|-----------|-----------------|-------------|--------|
| 1.1 | Normal (0–6 runs) | Yes | `runs` | `runs`, ball faced, 4s/6s on 4/6 | `runs` | ✅ |
| 1.2 | Wide | No | `runs + extraRuns` → `extras.wides` | None (no runs, no ball faced) | `runs + extraRuns` | ✅ |
| 1.3 | No-ball (new format: `runs` + `extraRuns:1`) | No | `runs + extraRuns` | `runs` (incl. 4s/6s if boundary), ball faced | `runs + extraRuns` | ✅ |
| 1.4 | No-ball (legacy format: `runs:0, extraRuns:5`) | No | `extraRuns` → `extras.noBalls` | none/legacy-shaped, verify no crash | `extraRuns` | ✅ |
| 1.5 | Bye | Yes | `runs` → `extras.byes` | Ball faced, no runs credited | `runs` (conceded) | ✅ |
| 1.6 | Leg bye | Yes | `runs` → `extras.legByes` | Ball faced, no runs credited | `runs` (conceded) | ✅ |
| 1.7 | Wide of 7 runs (5 byes + 2 wide, extreme overthrow case) | No | full total to `extras.wides` | none | full total | ✅ |
| 1.8 | No-ball of 8 (6 hit + 1 penalty + byes combo) | No | full total | batsman gets hit runs | full total | ✅ |
| 1.9 | Missing `batsmanIndex`/`bowlerIndex` on a ball | No crash; graceful handling | ✅ |
| 1.10 | Empty ball array | `{runs:0, wickets:0, legalBalls:0, ...}` all zeroed | ✅ |

## Dismissal credit matrix (bowler-credited vs not)

`BOWLER_CREDITED_DISMISSALS = {'bowled','caught','lbw','stumped','hit wicket'}`

| # | `dismissalType` | Bowler gets wicket? | Status |
|---|------------------|----------------------|--------|
| 2.1 | `'bowled'` | Yes | ✅ |
| 2.2 | `'caught'` | Yes | ✅ |
| 2.3 | `'lbw'` | Yes | ✅ |
| 2.4 | `'stumped'` | Yes | ✅ |
| 2.5 | `'hit wicket'` | Yes | ✅ |
| 2.6 | `'run out'` | No (charged to team only) | ✅ |
| 2.7 | `'retired hurt'` | No | ✅ |
| 2.8 | `'obstructing the field'` | No | ✅ |
| 2.9 | `'timed out'` | No | ❌ (not in the 7-case matrix already tested — verify it's handled if reachable from UI) |
| 2.10 | `null`/`undefined` dismissalType (legacy data) | Treated as bowler-credited | ✅ |
| 2.11 | Wicket attributed via `outBatsmanIndex` (run-out, non-striker) vs default `batsmanIndex` | Correct batsman charged | ✅ |

## Batsman / bowler stats

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 3.1 | Fours/sixes on normal delivery | Counted | ✅ |
| 3.2 | Fours/sixes on no-ball (batsman hits 4/6 off a no-ball) | Counted | ✅ |
| 3.3 | "Fours/sixes" of 4 or 6 runs off a wide | Never counted (wide gives no batsman credit at all) | ✅ |
| 3.4 | Balls faced excludes wide | ✅ | ✅ |
| 3.5 | Balls faced excludes... does it exclude no-ball too? | Verify: batsman *does* face a no-ball (gets runs+ball faced) per code, only wide is excluded — confirm this asymmetry is intentional and tested | ⚠️ |
| 3.6 | Bowler keyed by `bowlerName ?? bowlerIndex` | Stats aggregate correctly when only one is present | ✅ |
| 3.7 | Bowler runs conceded includes extras (wide/no-ball penalty) always | ✅ | ✅ |
| 3.8 | Bowler balls bowled excludes wide and no-ball | ✅ | ✅ |

## `formatOvers`, `calculateRR`, `calculateRequiredRR`, `getCurrentOver`, `ballDisplay`

| # | Function | Scenario | Expected | Status |
|---|----------|----------|----------|--------|
| 4.1 | `formatOvers` | `legalBalls = 8` | `"1.2"` | ✅ |
| 4.2 | `formatOvers` | `legalBalls = 0` | `"0.0"` | ✅ |
| 4.3 | `calculateRR` | `legalBalls = 0` | `"0.00"` (avoid divide-by-zero) | ✅ |
| 4.4 | `calculateRR` | Standard mid-innings values | `(runs/(legalBalls/6)).toFixed(2)` | ✅ |
| 4.5 | `calculateRequiredRR` | `remainingBalls <= 0` (overs used up, chase not done) | `"-"` | ✅ |
| 4.6 | `calculateRequiredRR` | Standard chase mid-innings | Correct required run rate | ✅ |
| 4.7 | `calculateRequiredRR` | Target already reached at time of calc (`runsNeeded <= 0`) | Verify displayed value makes sense (e.g. `"0.00"` not negative) | ❌ |
| 4.8 | `getCurrentOver` | Over with wides/no-balls mixed in | Slice includes them for display, but they don't count toward the 6 legal balls that close the over | ✅ |
| 4.9 | `ballDisplay` | Every ball type: normal (`0`–`6` or `.` for dot), `Wd`+total, `Nb`+total, `B`+total, `Lb`+total, `W`/`W{runs}` for wicket | All render correct short codes | ✅ |

## `restoreStateFromBalls` — strike rotation & state reconstruction

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 5.1 | Fresh match, no balls | `{striker:0, nonStriker:1, bowlerIdx:0}` | ✅ |
| 5.2 | Odd runs off a normal ball | Striker/non-striker swap | ✅ |
| 5.3 | Even runs off a normal ball | No swap | ✅ |
| 5.4 | Odd runs off a bye/leg-bye | Swap (byes/leg-byes are legal deliveries, runs count for rotation) | ✅ |
| 5.5 | Any runs off a wide | Never rotates strike (own runs only, ~0 physical runs) | ✅ |
| 5.6 | No-ball with batsman hitting odd runs (`tapRuns` vs `physicalRuns`) | Rotation based on `physicalRuns` (excludes the 1-run penalty), not total | ✅ |
| 5.7 | Consecutive wides across an over boundary | No rotation triggered by the wides themselves | ✅ |
| 5.8 | Two full overs of alternating swaps that net out | Final striker/non-striker match expected parity | ✅ |
| 5.9 | Wicket: `newBatsmanIndex` explicitly persisted on the ball | Incoming batsman = that value, not auto-computed | ✅ |
| 5.10 | Wicket: no `newBatsmanIndex` persisted | Falls back to `nextAvailableBatsman` (lowest index not out/on strike) | ✅ |
| 5.11 | Run-out crediting non-striker (`outBatsmanIndex` differs from `batsmanIndex`) | Correct player marked out, correct player replaced | ✅ |
| 5.12 | Run-out on the last ball of an over | Over-end swap + bowler increment still applies correctly alongside the wicket replacement | ✅ |
| 5.13 | End of over (`legalBalls % 6 === 0`) | Striker/non-striker swap + `bowlerIdx++` | ✅ |
| 5.14 | Legacy ball missing `newBatsmanIndex`, only has `batsmanIndex` | Self-heals by using `batsmanIndex` | ✅ |
| 5.15 | `nextAvailableBatsman` skip logic when several players already out | Correctly skips all indices in the out-set | ✅ |
| 5.16 | Ball sequence with an edited/retro-inserted ball (via Scoring "edit ball" UI) that changes an earlier over's outcome | Re-running `restoreStateFromBalls` over the full updated ball list produces correct final state | ❌ (state-restore is pure/re-derived, but no test explicitly exercises an edited-then-restored sequence) |
