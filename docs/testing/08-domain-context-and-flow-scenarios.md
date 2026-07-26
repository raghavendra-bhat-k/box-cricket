# 08 — Domain Scenarios: Ball Position, App Version, and Settings

Continues the domain-derived (implementation-independent) approach from
[07-domain-ball-outcomes.md](./07-domain-ball-outcomes.md), layering three axes that any
atomic outcome from doc 07 can combine with. These are described as modifiers rather than
a full cross-product with every doc-07 row — each modifier's effect is the same regardless
of which underlying run/extra/wicket outcome triggers it, so one or two worked examples per
modifier are enough to pin down the expected behavior.

App version (v1 "quick scoring" vs v2 "guided scoring") and per-match settings are both
part of this app's actual scoped feature set (configurable in `NewMatch`/`Settings`), so —
unlike doc 07's "what should a correct scorer do" framing — this doc's version/settings
sections describe **what the app's own advertised feature set commits to**, independent of
whether the current code delivers on it. Implementation gaps are still deferred to doc 09.

## Ball-position context modifiers

| # | Context | Expected additional effect (on top of the atomic outcome) |
|---|---------|----------------------------------------------------------|
| 1.1 | 1st ball of the innings | Both batsmen start at 0/0, bowler at 0/0/0, no extras yet; the outcome applies against an all-zero baseline |
| 1.2 | Mid-over, not the 6th ball | Baseline — no additional effect beyond the atomic outcome |
| 1.3 | 6th legal ball of the over | Regardless of the ball's own run parity, ends swap **and** a new bowler takes the next over. A wicket falling on this ball still triggers the end-of-over swap on top of any wicket-driven replacement — worked example: 6th ball is a run-out with 1 completed run (ends already crossed once for the run) — the over-end swap then applies a *second* crossing, so the batsman who was originally on strike ends up back on strike for the new over (net two crossings cancel) |
| 1.4 | Ball that ends the innings (all batsmen out, or the over/ball limit reached) | The innings stops immediately at that ball, even mid-over — no further deliveries in the innings. Worked example: last recognized batsman given out mid-over — the innings ends right there, the remaining balls in that over are never bowled |
| 1.5 | Ball that ends the match | In the second innings, the match ends the instant the chasing team's score strictly exceeds the target — even on the first ball of a new over, mid-over, off a boundary that overshoots what was needed. A ball that brings the score to *exactly* level with the target does **not** end the match by itself; the innings continues (next ball, over, or the overs/wickets limit) until it resolves as a tie or the target is later exceeded |

## App-version scenarios (v1 "quick scoring" vs v2 "guided scoring")

The app advertises two scoring modes, selected per match: a fast, minimal-friction v1 flow
and an opt-in v2 "guided" flow with structured pre-ball prompts. Scoped scenarios:

| # | Scenario | v1 expected behavior | v2 expected behavior |
|---|----------|------------------------|------------------------|
| 2.1 | Over completes, new over begins | Scorer can keep scoring immediately; the app should still make clear (e.g. a banner) that a new bowler needs to be recorded | Scorer is required to explicitly confirm/select the bowler for the new over before any further ball can be scored |
| 2.2 | A wicket falls | A single, fast entry captures dismissal type + who's out + incoming batsman in one flow | A structured, step-by-step capture (dismissal type, then who's out if relevant, then incoming batsman) — trades speed for reducing data-entry mistakes |
| 2.3 | Match/innings setup | Minimal — team/over/player setup only | Structured pre-match flow: toss (who won, bat-or-bowl election), then explicit opening striker/non-striker/bowler selection before ball 1 |
| 2.4 | Reversing a mistake | Undo the most recent ball | Undo **and** redo, so an accidental undo can be recovered |
| 2.5 | Correcting an error several balls back | Should be possible to open any earlier ball in the current over and correct its recorded outcome | Not necessarily expected — v2's trade-off for structured entry is that mistakes are corrected by relying more heavily on undo/redo rather than direct historical edits |
| 2.6 | Changing team size or overs mid-match (e.g. a late-arriving player, or shortening the match for time) | Should be supported, with sensible guardrails (can't reduce below what's already happened — wickets already fallen, overs already bowled) | Not a stated expectation of the "guided" mode — its scope is structured *ball-level* entry, not mid-match reconfiguration |
| 2.7 | Audit trail of scoring actions | Not an expected feature | Expected — the "guided" mode's value proposition includes traceability, so a log of key actions (toss, each ball, corrections) should exist |

## Settings-driven numeric-change scenarios ("count changes mid-match")

Both modes let the scorer configure numeric limits before the match starts (overs per
innings, players per side) and may allow changing them mid-match. Domain expectation:

| # | Scenario | Expected behavior |
|---|----------|----------------------|
| 3.1 | Players-per-side increased mid-innings (e.g. 6 → 7, a late player arrives) | The "all out" threshold should recompute against the new count immediately — the batting side shouldn't be forced all-out early because of a since-corrected undercount |
| 3.2 | Players-per-side decreased mid-innings | Should not be allowed to drop below a number that would immediately contradict the current wicket count (i.e. can't set a team size that implies the not-out batsmen currently at the crease don't exist) |
| 3.3 | Overs-per-innings increased mid-innings | The overs-complete threshold should recompute against the new total on the very next ball |
| 3.4 | Overs-per-innings decreased mid-innings | Should not be allowed to drop below the number of overs already effectively used (a partially-bowled over still "uses" that over — you can't retroactively shrink the match to fewer overs than have already been bowled) |
| 3.5 | Settings toggle changed *between* matches (e.g. switching guided sub-toggles on/off) vs *during* a live match | Changing settings mid-match should only affect *future* prompts/behavior, never retroactively alter balls already recorded |
