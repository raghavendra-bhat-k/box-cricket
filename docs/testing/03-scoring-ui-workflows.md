# 03 — Scoring UI Workflows (`Scoring.jsx` v1 / `ScoringV2.jsx` guided)

See [README.md](./README.md) for the status legend.

## Ball entry — runs

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 1.1 | Tap each enabled run button (0,1,2,3,4,6) | Ball recorded with correct runs; 0-3 as `run` type, 4/6 as `boundary` | ✅ |
| 1.2 | Tap a run button disabled via custom rules | Button not rendered at all | ✅ |
| 1.3 | Tap a run button that's remapped (e.g. `4→5`) | Button shows `4→5` label; recorded runs = mapped value (5), not tap value | ✅ |
| 1.4 | Odd run scored | Strike rotates for next ball | ✅ |
| 1.5 | 6th legal ball of the over scored | Strike rotates regardless of run parity (over-end swap) + bowler auto-increments | ✅ |

## Ball entry — extras sheet

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 2.1 | Wide, default (no extra runs) | 1 penalty run to team, no ball faced, no legal-ball increment | ✅ |
| 2.2 | Wide + custom extra runs (overthrows) | Total wide runs recorded correctly | ✅ |
| 2.3 | No Ball, batsman scores 0/1/2/4/6 off it | Penalty (1) + batsman runs recorded; legal-ball count doesn't increment | ✅ |
| 2.4 | No Ball + custom "+" input for unusual run value | Accepted | ✅ |
| 2.5 | Bye, runs 1/2/3/4/6 | Legal ball; runs to `extras.byes`, no batsman credit | ✅ |
| 2.6 | Leg Bye, runs 1/2/3/4/6 | Legal ball; runs to `extras.legByes`, no batsman credit | ✅ |
| 2.7 | Bye/Leg Bye + custom "+" input | Accepted | ✅ |

## Ball entry — wicket sheet

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 3.1 | Each dismissal type: Bowled, Caught, Run Out, Stumped, LBW, Hit Wicket | Correctly stored (lowercased) `dismissalType`; correct run-picker (0,1,2,3,4,6+custom) for runs completed before dismissal | ✅ |
| 3.2 | Run Out — select "who is out?" = striker | `outBatsmanIndex` = striker index | ✅ |
| 3.3 | Run Out — select "who is out?" = non-striker | `outBatsmanIndex` = non-striker index | ✅ |
| 3.4 | Non-run-out dismissal | No "who is out?" prompt (always the striker) | ⚠️ |
| 3.5 | New batsman auto-selected | Defaults to `max(striker, nonStriker) + 1` | ✅ |
| 3.6 | "Who's batting next?" sheet appears | Only when named players remain beyond the auto-computed index | ✅ |
| 3.7 | Override the auto-selected incoming batsman | `newBatsmanIndex` persisted with the override | ✅ |
| 3.8 | Wicket on the last ball of the over | Both wicket-replacement and over-end bowler/strike rotation apply correctly together | ✅ |
| 3.9 | Wicket that ends the innings (last man out) | No "next batsman" prompt; innings-over flow triggers instead | ⚠️ (see doc 04) |

## Undo / Redo

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 4.1 | Undo (v1) after a normal run ball | Last ball removed, state (score, striker, bowler) restored via `restoreStateFromBalls` | ✅ |
| 4.2 | Undo (v1) after a wicket | Dismissed batsman restored, incoming batsman removed | ✅ |
| 4.3 | Undo (v1) after an extra (wide/no-ball/bye/leg-bye) | Correct reversal of legal-ball count and extras totals | ✅ |
| 4.4 | Undo with zero balls bowled | No-op / disabled, no crash | ⚠️ |
| 4.5 | Undo/Redo (v2) — undo then redo restores exact same state | ✅ | ✅ |
| 4.6 | Undo/Redo (v2) — undo, then score a *new* ball (diverging from the undone one) | Redo history is invalidated/cleared, not stale | ❌ |
| 4.7 | Undo/Redo (v2) toggled off via Settings | Undo/Redo controls hidden/disabled in v2 scoring screen | ✅ |

## Edit previous ball (v1 only)

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 5.1 | Tap a ball dot in the current over | Opens `editBall` sheet pre-filled with that ball's data | ✅ |
| 5.2 | Change runs on an existing normal ball | Ball updated in place, score recalculated | ✅ |
| 5.3 | Retroactively mark a normal ball as a wicket | Ball converted, dismissal type required | ✅ |
| 5.4 | Retroactively mark a normal ball as an extra (Wd/Nb) | Ball converted, legal-ball count recalculated for the whole innings | ✅ |
| 5.5 | Change dismissal type on an existing wicket ball | Bowler credit recalculated if crossing the bowler-credited boundary (e.g. bowled → run out) | ⚠️ |
| 5.6 | Attempt to edit a ball from a *previous* (already-completed) over | Verify whether UI restricts editing to only the current over, or allows editing any ball — confirm actual scope | ❌ |

## Bowler management

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 6.1 | Over completes | Bowler index auto-increments; non-blocking "bowler-change-banner" shown | ✅ |
| 6.2 | `forceBowlerEachOver` setting ON (v2) | Scoring blocked until a bowler is explicitly selected/confirmed for the new over | ✅ |
| 6.3 | `forceBowlerEachOver` setting OFF (v2) | Scoring can proceed without explicit reconfirmation each over | ⚠️ |
| 6.4 | Bowler picker — search existing roster | Filters correctly | ✅ |
| 6.5 | Bowler picker — enter a custom (new) bowler name | Accepted and added | ✅ |
| 6.6 | Bowler picker — drag to reorder `bowlingOrder` | Order persisted | ✅ |
| 6.7 | Same bowler bowls consecutive overs (no cap enforced) | Allowed — 🚫 no per-bowler over limit exists in this app | 🚫 |

## Menu actions

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 7.1 | Add Player (mid-match, team A or B) | New player appended to roster | ✅ |
| 7.2 | Change Team Sizes | Min-guard = `wickets + 2` for the batting team (can't shrink below current wicket count) | ✅ |
| 7.3 | Attempt to set team size below the min-guard | Rejected/clamped | ⚠️ |
| 7.4 | Change Overs mid-match | Min-guard = overs already bowled (can't set fewer than what's been played) | ✅ |
| 7.5 | Attempt to set overs below overs already bowled | Rejected/clamped | ⚠️ |
| 7.6 | Edit Player Names via drag-reorder list | Names updated, order changed | ✅ |
| 7.7 | Remove Player mid-match | Player removed from roster; verify no crash if that player has already batted/bowled (historical stats should remain intact) | ⚠️ |
| 7.8 | View Scorecard from menu | Navigates to Scorecard with current state | ✅ |
| 7.9 | View Ball by Ball from menu | Opens `BallLog` | ✅ |
| 7.10 | Share Match Sync File from menu | Triggers sync export/share flow | ✅ |
| 7.11 | Go Home from menu mid-match | Navigates home; match remains `live` and resumable | ✅ |

## ScoringV2-specific guided flows

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 8.1 | Toss: Team A wins, elects to bat | `resolveBattingFirst` sets Team A batting first | ✅ |
| 8.2 | Toss: Team A wins, elects to bowl | Team B bats first | ✅ |
| 8.3 | Toss: Team B wins (either election) | Correct battingFirst resolution | ✅ |
| 8.4 | `Settings.toss` OFF | Toss step skipped entirely | ✅ |
| 8.5 | Opening batsmen/bowler selection via `StartupFlow` | Striker, non-striker, opening bowler all captured before first ball | ✅ |
| 8.6 | `Settings.openingBatsmen` OFF | Startup defaults to index 0/1/0 without prompting | ⚠️ |
| 8.7 | Resume a match mid-`StartupFlow` (before first ball bowled) | Startup state survives app reload | ✅ |
| 8.8 | Detailed wicket full-screen flow (`Settings.detailedWicket` ON) | Multi-step wicket capture (type, fielder if caught, etc.) | ✅ |
| 8.9 | `Settings.detailedWicket` OFF | Simplified/inline wicket capture instead | ⚠️ |
| 8.10 | Home/back navigation guard mid-match | Confirms before leaving/losing in-progress state | ✅ |
| 8.11 | `Settings.homeButton` OFF | Home button hidden from Scoring screen | ⚠️ |
| 8.12 | Audit log entries created for key actions (match created, toss, ball scored, undo, etc.) | Entries appended with correct per-match `seq` | ✅ |
| 8.13 | `Settings.auditLog` OFF | No audit entries recorded | ⚠️ |
| 8.14 | Each `Settings.jsx` toggle flipped independently (guidedScoring master toggle, toss, openingBatsmen, forceBowlerEachOver, detailedWicket, undoRedo, homeButton, auditLog) | Verify each toggle's effect is isolated — flipping one doesn't unexpectedly affect another | ❌ (only some combinations covered by `settings.test.js`) |
| 8.15 | `guidedScoring` master toggle OFF | Routes to v1 `Scoring.jsx` instead of `ScoringV2.jsx` regardless of sub-toggle states | ⚠️ |
