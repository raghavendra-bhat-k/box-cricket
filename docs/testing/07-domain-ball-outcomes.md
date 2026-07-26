# 07 — Domain-Derived Ball Outcome Scenarios (Atomic)

## Scope and method

These scenarios are derived **independently of the current implementation** — they state
what a correct box-cricket scoring app *should* do for each ball outcome, based on standard
cricket scoring conventions, scoped to the specific feature set this app exposes:

- **Extras**: Wide, No Ball, Bye, Leg Bye (the app has no other extra types — e.g. no
  penalty runs for illegal fielding)
- **Dismissals**: Bowled, Caught, Run Out, Stumped, LBW, Hit Wicket (the six types the UI
  offers a scorer — the app's engine also *recognizes* `retired hurt`, `obstructing the
  field`, and `timed out` for bowler-credit purposes, but no UI surface produces them, so
  they're out of scope for scenario authoring here and are called out separately in doc 09)
- **Run values**: 0–6 per ball (values above 6 only arise from extras/overthrows, not a
  single shot)
- No free-hit-after-no-ball rule, no powerplay/fielding-restriction rules, no DLS, no
  super over — this app doesn't model any of these, so they're not in scope

Whether the current code actually behaves this way is addressed separately in
[09-domain-vs-implementation-diff.md](./09-domain-vs-implementation-diff.md) — treat this
document as the "expected" side of that comparison, not a description of `scoring.js`.

## State schema

Each scenario is stated as **Before → Ball → After** over this state:

| Field | Meaning |
|---|---|
| Team score / wickets | Runs and wickets for the batting side |
| Legal balls (over.ball) | Balls that count toward the 6-ball over |
| Striker | Runs, balls faced |
| Non-striker | Identity only (assume not currently scoring) |
| Bowler | Runs conceded, balls bowled, wickets |
| Extras | wides / no-balls / byes / leg-byes totals |
| End crossing | Whether the striker and non-striker swap ends |

Baseline "Before" used throughout (unless a row says otherwise): Score 40/2, legal balls
14 (over 2.2), Striker 20 runs off 15 balls, Bowler figures 1/18 off 14 balls, extras so
far 3/1/0/2 (wd/nb/b/lb).

## Normal runs off the bat (0–6)

A run is "completed" when both batsmen have grounded their bat behind the crease at the
non-striker's end. Ends cross on an **odd** number of completed runs.

| # | Runs | Team score after | Striker after | Bowler after | Ball counts toward over? | Ends cross? |
|---|------|-------------------|-----------------|----------------|-----------------------------|--------------|
| 1.1 | 0 (dot ball) | 40/2 | 20 off 16 | 1/18 off 15 | Yes | No |
| 1.2 | 1 | 41/2 | 21 off 16 (striker becomes new non-striker after crossing) | 1/19 off 15 | Yes | Yes |
| 1.3 | 2 | 42/2 | 22 off 16 | 1/20 off 15 | Yes | No |
| 1.4 | 3 | 43/2 | 23 off 16, ends cross | 1/21 off 15 | Yes | Yes |
| 1.5a | 4 (running four — batsmen physically run all 4, ball stays in the field) | 44/2 | 24 off 16 (no 4s tally credit — not a boundary) | 1/22 off 15 | Yes | No (4 is even) |
| 1.5b | 4 (boundary — ball reaches the rope) | 44/2 | 24 off 16 (4s tally +1) | 1/22 off 15 | Yes | No (batsmen don't run a boundary) |
| 1.6 | 5 (three physically run + overthrow, or straight 5 in a large ground) | 45/2 | 25 off 16, ends cross (5 is odd) | 1/23 off 15 | Yes | Yes |
| 1.7 | 6 (boundary, over the rope on the full) | 46/2 | 26 off 16 (6s tally +1) | 1/24 off 15 | Yes | No |

## Wide

Domain rule: a wide always carries a minimum 1-run penalty to the batting team, is **not**
a legal delivery (must be re-bowled — doesn't count toward the over), and the striker gets
**no runs, no ball faced**. If the batsmen additionally run byes after the keeper/fielder
misses the ball, or the ball reaches the boundary after being called wide, those extra runs
are also credited as wides. End-crossing follows the batsmen's **physically run** extra
runs (excluding the automatic 1-run penalty, since that isn't run); a wide that reaches the
boundary is not physically run and never crosses ends.

| # | Total wide runs | Physically run (excl. penalty) | Team score after | Extras (wides) after | Ends cross? |
|---|-------------------|-----------------------------------|---------------------|--------------------------|--------------|
| 2.1 | 1 (plain wide, no run) | 0 | 41/2 | 4 | No |
| 2.2 | 2 (1 run taken after the miss) | 1 | 42/2 | 6 | Yes (1 physical run is odd) |
| 2.3 | 3 ("3wd" — 2 runs taken) | 2 | 43/2 | 9 | No (2 is even) |
| 2.4 | 4 (3 runs taken — unusual, e.g. overthrow) | 3 | 44/2 | 13 | Yes (3 is odd) |
| 2.5 | 5 ("5wd" — ball reaches the boundary) | 0 (boundary, not run) | 45/2 | 18 | No |

## No Ball

Domain rule: a no-ball carries a fixed 1-run penalty and is **not** a legal delivery
(re-bowled). Unlike a wide, the batsman **can** hit the ball and score off it — those runs
are the batsman's own (fours/sixes count normally) and are added on top of the 1-run
penalty. End-crossing follows only the batsman's own runs off the bat (the 1-run penalty
itself is never run).

| # | Batsman's runs off the no-ball | Team score after | Striker after | Extras (no-balls) after | Ends cross? |
|---|-----------------------------------|---------------------|-----------------|-------------------------------|--------------|
| 3.1 | 0 (ball missed/blocked) | 41/2 | 20 off 16 | 1 | No |
| 3.2 | 1 | 42/2 | 21 off 16, ends cross | 1 | Yes |
| 3.3 | 2 | 43/2 | 22 off 16 | 1 | No |
| 3.4 | 4 (boundary off a no-ball) | 45/2 | 24 off 16 (4s +1) | 1 | No |
| 3.5 | 6 (six off a no-ball) | 47/2 | 26 off 16 (6s +1) | 1 | No |

## Bye

Domain rule: the ball passes the striker entirely (no bat or body contact) and the
batsmen run; this **is** a legal delivery (counts toward the over). No runs credited to
the striker (they didn't touch it); runs go entirely to extras. End-crossing follows the
normal odd/even rule on the runs actually run (a bye that reaches the boundary isn't run
by the batsmen).

| # | Bye runs | Team score after | Striker after (runs unaffected, balls faced +1) | Extras (byes) after | Legal ball? | Ends cross? |
|---|-----------|---------------------|-----------------------------------------------------|--------------------------|-------------|--------------|
| 4.1 | 1 | 41/2 | 20 off 16 | 1 | Yes | Yes |
| 4.2 | 2 | 42/2 | 20 off 16 | 2 | Yes | No |
| 4.3 | 3 | 43/2 | 20 off 16 | 3 | Yes | Yes |
| 4.4 | 4 (byes to the boundary) | 44/2 | 20 off 16 | 4 | Yes | No |

## Leg Bye

Domain rule: identical to a bye mechanically, except the ball deflects off the batsman's
body/pads (not the bat) rather than missing entirely. Same crediting and crossing rules as
Bye, just tallied separately (`extras.legByes`).

| # | Leg-bye runs | Team score after | Extras (leg-byes) after | Legal ball? | Ends cross? |
|---|----------------|---------------------|-------------------------------|-------------|--------------|
| 5.1 | 1 | 41/2 | 1 | Yes | Yes |
| 5.2 | 2 | 42/2 | 2 | Yes | No |
| 5.3 | 4 (leg-byes to the boundary) | 44/2 | 4 | Yes | No |

## Wickets

Domain rule per dismissal type, scoped to the six the UI exposes. `Before`: Score 40/2 as
above; a third wicket is about to fall.

| # | Dismissal | Runs completed before the wicket | Bowler credited? | Notes |
|---|-----------|--------------------------------------|----------------------|-------|
| 6.1 | Bowled | Always 0 — the ball has already hit the stumps, ending the delivery | Yes | No end-crossing scenario applies |
| 6.2 | Caught | Always 0 — any runs run before a catch is completed are voided under the Laws of Cricket (the striker is out regardless of a completed run) | Yes | The new batsman comes in at the striker's end, no crossing |
| 6.3 | LBW | Always 0 — dismissal is adjudicated on the delivery that struck the pads, before a run can be completed | Yes | No end-crossing scenario applies |
| 6.4 | Stumped | Always 0 in the ordinary case (missed the ball, keeper takes off the bails before a run is completed); a bye taken simultaneously with a stumping is a rare edge case out of scope | Yes | No end-crossing scenario applies |
| 6.5 | Hit Wicket | Always 0 — the batsman dislodges their own stumps in the act of playing a shot or setting off, ending the delivery immediately | Yes | No end-crossing scenario applies |
| 6.6a | Run Out — 0 runs completed, striker fails to make the crease | 0 | No | New batsman replaces the striker at the striker's end; non-striker stays put |
| 6.6b | Run Out — 1 run completed, then dismissed going for a 2nd, non-striker sent back | 1 | No | Batsmen had already crossed for the 1st run when the throw comes in; whichever batsman is short of their ground is out. If the striker (now at the non-striker's end after crossing) is out, the new batsman comes in at that end and the not-out batsman (now physically at the original striker's end) keeps the strike |
| 6.6c | Run Out — non-striker dismissed backing up / short mid-run | 0 or 1 (depends whether they'd crossed) | No | If they hadn't crossed, no run is added and the striker retains strike; if they had crossed, the run stands and ends have swapped before the replacement |
