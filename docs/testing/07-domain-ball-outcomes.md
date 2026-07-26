# 07 — Anchor-Based Ball Outcome Scenarios

## Purpose and method

This document takes a fixed **anchor state** (the exact state of the match *before* a ball
is bowled) and enumerates **every possible outcome of that one ball**, giving the full
**after-state** for each. The anchor is then moved to each positional context — first ball
of the innings, last ball of an over, last ball of the innings, last ball of the match —
and the full enumeration is repeated, because the positional context changes what the same
outcome does to the match.

These scenarios are **derived from standard cricket scoring rules scoped to this app's
feature set**, *independent of how the code currently behaves*. Where the current
implementation would do something different, that is not corrected here — it's captured
separately in [09-domain-vs-implementation-diff.md](./09-domain-vs-implementation-diff.md).
Read this as the "expected" (oracle) side of the comparison.

### Outcome set enumerated at each anchor

| Group | Values |
|---|---|
| Runs off the bat | 0, 1, 2, 3, 4, 5, 6 |
| Wide | 1wd, 2wd, 3wd, 4wd, 5wd |
| No ball | nb (0 off bat), nb+1, nb+2, nb+4, nb+6 |
| Bye | 1b, 2b, 3b, 4b |
| Leg bye | 1lb, 2lb, 3lb, 4lb |
| Wicket (bowler-type) | Bowled, Caught, LBW, Stumped, Hit Wicket (0 completed runs) |
| Wicket (run out) | striker out / non-striker out, at 0 and 1 completed runs |

### Notation

- **Team**: `runs/wickets`.
- **Balls**: legal-ball count as `over.ball` (e.g. `2.2` = 14 legal balls).
- **On strike after** shown as `→Name runs(balls)`; the other batsman is the non-striker.
- **Bowler**: `wkts–runs (over.ball)` — cumulative for the bowler's spell.
- **Rot?** = do the two batsmen swap ends as a result of this ball (before any over-end
  swap)? Odd **run** (physically run) → yes; even → no.
- **Legal?** = does the delivery count toward the six-ball over? Wide and no-ball do **not**
  (they are re-bowled); everything else does.

### Domain rules applied (scoped to this app)

- A **wide** adds ≥1 penalty run, is not legal, gives the striker no runs and no ball faced.
  Any additional runs on a wide are those the batsmen physically ran (or a boundary); those
  physically-run runs determine the end-crossing. A boundary-wide (5wd here) is not run, so
  no crossing.
- A **no-ball** adds a fixed 1 penalty run, is not legal; the striker may score off it (own
  runs, boundaries counted), faces a ball, and the batsman's own runs determine crossing.
- **Byes / leg-byes** are legal deliveries; the striker faces a ball but is credited no
  runs; the runs are debited to the batting *team*, **not the bowler** (Laws of Cricket);
  the runs run determine crossing.
- A **wicket** other than run-out ends the delivery with 0 completed runs (runs before a
  catch/bowled/lbw/stumped/hit-wicket are void). A **run out** may have completed runs,
  and either batsman can be the one dismissed.
- At the **end of an over** (6th legal ball) the batsmen additionally swap ends and a new
  bowler bowls the next over.
- **Bowler-credited** dismissals: Bowled, Caught, LBW, Stumped, Hit Wicket. Run out is
  charged to the team only (bowler gets no wicket).

---

## Anchor A — mid-over, mid-innings (baseline reference)

**Before-state** (fully annotated; later anchors reuse this format):

- Innings 1, `playersPerSide = 6` → all out at 5 wickets. Next incoming batsman = index 4 ("P5").
- Team **40/2**, legal balls **14** → **2.2** (next legal ball becomes 2.3).
- On strike: **P3** (idx 2) — **20 (15)**, 2 fours, 1 six.
- Non-striker: **P4** (idx 3) — **8 (10)**.
- Bowler: **B2** — **1–18 (1.2)**, i.e. 1 wkt / 18 runs / 8 balls this spell.
- Extras so far: **W3, Nb1, B0, Lb2**.

| # | Outcome | Team | Legal | On strike after | Non-striker | Bowler | Extras Δ | Rot? |
|---|---|---|---|---|---|---|---|---|
| A-r0 | 0 (dot) | 40/2 | 2.3 | →P3 20(16) | P4 8(10) | 1–18 (1.3) | — | N |
| A-r1 | 1 | 41/2 | 2.3 | →P4 8(10) | P3 21(16) | 1–19 (1.3) | — | Y |
| A-r2 | 2 | 42/2 | 2.3 | →P3 22(16) | P4 8(10) | 1–20 (1.3) | — | N |
| A-r3 | 3 | 43/2 | 2.3 | →P4 8(10) | P3 23(16) | 1–21 (1.3) | — | Y |
| A-r4 | 4 (boundary) | 44/2 | 2.3 | →P3 24(16) *4s→3* | P4 8(10) | 1–22 (1.3) | — | N |
| A-r5 | 5 (rare; via custom input / overthrows to batsman) | 45/2 | 2.3 | →P4 8(10) | P3 25(16) | 1–23 (1.3) | — | Y |
| A-r6 | 6 (boundary) | 46/2 | 2.3 | →P3 26(16) *6s→2* | P4 8(10) | 1–24 (1.3) | — | N |
| A-w1 | 1wd (penalty only) | 41/2 | 2.2 | →P3 20(15) | P4 8(10) | 1–19 (1.2) | W→4 | N |
| A-w2 | 2wd (1 run physically run) | 42/2 | 2.2 | →P4 8(10) | P3 20(15) | 1–20 (1.2) | W→5 | Y |
| A-w3 | 3wd (2 run) | 43/2 | 2.2 | →P3 20(15) | P4 8(10) | 1–21 (1.2) | W→6 | N |
| A-w4 | 4wd (3 run) | 44/2 | 2.2 | →P4 8(10) | P3 20(15) | 1–22 (1.2) | W→7 | Y |
| A-w5 | 5wd (boundary, not run) | 45/2 | 2.2 | →P3 20(15) | P4 8(10) | 1–23 (1.2) | W→8 | N |
| A-n0 | nb (0 off bat) | 41/2 | 2.2 | →P3 20(16) *faced +1* | P4 8(10) | 1–19 (1.2) | Nb→2 | N |
| A-n1 | nb+1 | 42/2 | 2.2 | →P4 8(10) | P3 21(16) | 1–20 (1.2) | Nb→2 | Y |
| A-n2 | nb+2 | 43/2 | 2.2 | →P3 22(16) | P4 8(10) | 1–21 (1.2) | Nb→2 | N |
| A-n4 | nb+4 (boundary off no-ball) | 45/2 | 2.2 | →P3 24(16) *4s→3* | P4 8(10) | 1–23 (1.2) | Nb→2 | N |
| A-n6 | nb+6 | 47/2 | 2.2 | →P3 26(16) *6s→2* | P4 8(10) | 1–25 (1.2) | Nb→2 | N |
| A-b1 | 1b (bye) | 41/2 | 2.3 | →P4 8(10) | P3 20(16) *faced+1, no runs* | 1–18 (1.3) *runs unchanged* | B→1 | Y |
| A-b2 | 2b | 42/2 | 2.3 | →P3 20(16) | P4 8(10) | 1–18 (1.3) | B→2 | N |
| A-b3 | 3b | 43/2 | 2.3 | →P4 8(10) | P3 20(16) | 1–18 (1.3) | B→3 | Y |
| A-b4 | 4b (byes to boundary) | 44/2 | 2.3 | →P3 20(16) | P4 8(10) | 1–18 (1.3) | B→4 | N |
| A-l1 | 1lb (leg bye) | 41/2 | 2.3 | →P4 8(10) | P3 20(16) | 1–18 (1.3) | Lb→3 | Y |
| A-l2 | 2lb | 42/2 | 2.3 | →P3 20(16) | P4 8(10) | 1–18 (1.3) | Lb→4 | N |
| A-l3 | 3lb | 43/2 | 2.3 | →P4 8(10) | P3 20(16) | 1–18 (1.3) | Lb→5 | Y |
| A-l4 | 4lb | 44/2 | 2.3 | →P3 20(16) | P4 8(10) | 1–18 (1.3) | Lb→6 | N |
| A-Wb | Bowled (0) | 40/3 | 2.3 | →P5 0(0) *in at striker's end* | P4 8(10) | **2**–18 (1.3) | — | N |
| A-Wc | Caught (0) | 40/3 | 2.3 | →P5 0(0) | P4 8(10) | **2**–18 (1.3) | — | N |
| A-Wl | LBW (0) | 40/3 | 2.3 | →P5 0(0) | P4 8(10) | **2**–18 (1.3) | — | N |
| A-Ws | Stumped (0) | 40/3 | 2.3 | →P5 0(0) | P4 8(10) | **2**–18 (1.3) | — | N |
| A-Wh | Hit Wicket (0) | 40/3 | 2.3 | →P5 0(0) | P4 8(10) | **2**–18 (1.3) | — | N |
| A-Ro0 | Run Out, **striker** out, 0 runs | 40/3 | 2.3 | →P5 0(0) *striker's end* | P4 8(10) | 1–18 (1.3) *no wkt credit* | — | N |
| A-Ro1 | Run Out, **striker** out, 1 completed then out for 2nd | 41/3 | 2.3 | →P4 8(10) *kept strike after the 1* | P5 0(0) *in at far end* | 1–19 (1.3) | — | Y (the 1 crossed them) |
| A-Rn0 | Run Out, **non-striker** out, 0 runs (direct hit backing up) | 40/3 | 2.3 | →P3 20(16) *faced +1* | P5 0(0) *in at non-striker end* | 1–18 (1.3) | — | N |

*Notes for Anchor A:* bye/leg-bye rows leave the bowler's **runs** unchanged (domain rule);
the app diverges here — see doc 09. Wide rows 2wd/4wd rotate on the physically-run runs; the
app cannot represent physically-run runs on a wide and never rotates on any wide — see doc 09.
No-ball counts as a ball faced by the striker. Run-out end-placement for ≥2 completed runs
has further subtleties not enumerated here (rare in box cricket).

---

## Anchor B — first ball of the innings

**Before-state**: Team **0/0**, legal **0.0**, on strike **P1** (idx 0) 0(0), non-striker
**P2** (idx 1) 0(0), bowler **B1** 0–0 (0.0), extras all 0. Incoming after a wicket = idx 2 ("P3").

| # | Outcome | Team | Legal | On strike after | Non-striker | Bowler | Extras Δ | Rot? |
|---|---|---|---|---|---|---|---|---|
| B-r0 | 0 | 0/0 | 0.1 | →P1 0(1) | P2 0(0) | 0–0 (0.1) | — | N |
| B-r1 | 1 | 1/0 | 0.1 | →P2 0(0) | P1 1(1) | 0–1 (0.1) | — | Y |
| B-r2 | 2 | 2/0 | 0.1 | →P1 2(1) | P2 0(0) | 0–2 (0.1) | — | N |
| B-r3 | 3 | 3/0 | 0.1 | →P2 0(0) | P1 3(1) | 0–3 (0.1) | — | Y |
| B-r4 | 4 | 4/0 | 0.1 | →P1 4(1) *4s→1* | P2 0(0) | 0–4 (0.1) | — | N |
| B-r6 | 6 | 6/0 | 0.1 | →P1 6(1) *6s→1* | P2 0(0) | 0–6 (0.1) | — | N |
| B-w1 | 1wd | 1/0 | 0.0 | →P1 0(0) | P2 0(0) | 0–1 (0.0) | W→1 | N |
| B-n0 | nb | 1/0 | 0.0 | →P1 0(1) | P2 0(0) | 0–1 (0.0) | Nb→1 | N |
| B-b1 | 1b | 1/0 | 0.1 | →P2 0(0) | P1 0(1) | 0–0 (0.1) | B→1 | Y |
| B-Wb | Bowled (0) — a first-ball duck | 0/1 | 0.1 | →P3 0(0) | P2 0(0) | **1**–0 (0.1) | — | N |
| B-Rn0 | Run Out, non-striker out, 0 | 0/1 | 0.1 | →P1 0(1) | P3 0(0) | 0–0 (0.1) *no credit* | — | N |

*(Remaining outcomes follow the Anchor A pattern against the all-zero baseline: rows 2/3/5,
wides 2–5, no-balls 1/2/4/6, byes/leg-byes 2–4, and the other wicket types — same deltas as
A with every "before" figure starting at 0.)*

---

## Anchor C — last (6th) legal ball of the over

**Before-state**: Team **50/2**, legal **17** → **2.5** (the next *legal* ball is the 6th of
over 3, completing it). On strike **P3** 22(18), non-striker **P4** 14(15). Over's bowler
**B2** 0–15 (0.5) — 5 legal balls into this over. Extras W2, Nb0, B1, Lb1.

**Key positional rule**: a **legal** delivery (runs off the bat, byes, leg-byes) or a wicket
completes the over → *after* the ball's own rotation, the batsmen **swap ends again** and a
**new bowler** bowls the next over. A **wide or no-ball is not legal** → the over is **not**
completed (ball re-bowled), no over-end swap, same bowler continues.

| # | Outcome | Team | Legal | On strike (start of next over unless noted) | Non-striker | Bowler | Over ends? | Rot (net)? |
|---|---|---|---|---|---|---|---|---|
| C-r0 | 0 | 50/2 | 3.0 | →P4 14(15) *over-end swap* | P3 22(19) | B2 0–15 (1.0) | Yes | Y (over-end) |
| C-r1 | 1 | 51/2 | 3.0 | →P3 23(19) *own swap + over-end swap cancel* | P4 14(15) | B2 0–16 (1.0) | Yes | N (net) |
| C-r2 | 2 | 52/2 | 3.0 | →P4 14(15) | P3 24(19) | B2 0–17 (1.0) | Yes | Y |
| C-r3 | 3 | 53/2 | 3.0 | →P3 25(19) | P4 14(15) | B2 0–18 (1.0) | Yes | N |
| C-r4 | 4 | 54/2 | 3.0 | →P4 14(15) | P3 26(19) *4s+1* | B2 0–19 (1.0) | Yes | Y |
| C-r6 | 6 | 56/2 | 3.0 | →P4 14(15) | P3 28(19) *6s+1* | B2 0–21 (1.0) | Yes | Y |
| C-w1 | 1wd | 51/2 | 2.5 | →P3 22(18) *no over-end* | P4 14(15) | B2 0–16 (0.5) | **No** | N |
| C-w2 | 2wd (1 run) | 52/2 | 2.5 | →P4 14(15) | P3 22(18) | B2 0–17 (0.5) | **No** | Y |
| C-n0 | nb | 51/2 | 2.5 | →P3 22(19) | P4 14(15) | B2 0–16 (0.5) | **No** | N |
| C-n1 | nb+1 | 52/2 | 2.5 | →P4 14(15) | P3 23(19) | B2 0–17 (0.5) | **No** | Y |
| C-b1 | 1b | 51/2 | 3.0 | →P3 22(19) *bye swap + over-end swap cancel* | P4 14(15) | B2 0–15 (1.0) | Yes | N (net) |
| C-b2 | 2b | 52/2 | 3.0 | →P4 14(15) | P3 22(19) | B2 0–15 (1.0) | Yes | Y |
| C-Wb | Bowled (0) on the 6th ball | 50/3 | 3.0 | →P4 14(15) *over-end swap; new bat does NOT face* | **P5** 0(0) | B2 **1**–15 (1.0) | Yes | — |
| C-Ro1 | Run Out, striker out, 1 completed, on 6th ball | 51/3 | 3.0 | →P4 14(15) *the 1 crossed, then over-end swap* | P5 0(0) | B2 0–16 (1.0) | Yes | — |

**v1 vs v2 at this anchor** (state is identical; *flow* differs):
- **v1**: over-end swap + bowler increment happen automatically; a dismissible banner
  suggests recording the new bowler. Scoring can continue immediately.
- **v2** (with `forceBowlerEachOver` on): after the over completes, scoring is **blocked**
  by a full-screen "who bowls the next over?" step before the next ball can be entered. For
  the `C-Wb`/`C-Ro1` wicket-on-6th-ball rows, v2 shows the **wicket capture** step first,
  then the **new-bowler** step — two sequential prompts.

---

## Anchor D — last ball of the innings

**Before-state**: Innings 1, `totalOvers = 3` → innings ends at 18 legal balls. Team **55/3**,
legal **17** → **2.5** (next legal ball is the innings' final delivery). On strike **P5** 12(9),
non-striker **P6** 5(6). Bowler **B1** 1–20 (0.5). `playersPerSide = 6` → all out at 5 wkts
(currently 3, so a wicket here is *not* all out unless it's the... it is the 4th, still not all out).

**Key positional rule**: same legal-vs-illegal contrast as Anchor C, but the over-end here
is also the **innings-end**. A legal ball (or a wicket) ends the innings; a wide/no-ball does
**not** (re-bowl — the innings continues for one more legal ball). A wicket that makes it the
5th also ends the innings via **all-out**, independent of overs.

| # | Outcome | Team | Legal | Result | Notes |
|---|---|---|---|---|---|
| D-r0 | 0 | 55/3 | 3.0 | **Innings ends** (overs complete) | firstInningsScore = 55; break screen |
| D-r1 | 1 | 56/3 | 3.0 | **Innings ends** | firstInningsScore = 56 |
| D-r6 | 6 | 61/3 | 3.0 | **Innings ends** | last-ball six |
| D-w1 | 1wd | 56/3 | 2.5 | **Innings continues** | not legal → ball re-bowled, still one legal ball owed |
| D-n1 | nb+1 | 57/3 | 2.5 | **Innings continues** | re-bowl |
| D-b1 | 1b | 56/3 | 3.0 | **Innings ends** | bye is legal → completes the over/innings |
| D-Wb | Bowled (0), 4th wicket, on final ball | 55/4 | 3.0 | **Innings ends** (overs complete) | would also end via overs even without the wicket |
| D-Wall | Wicket that is the **5th** (if before-state were 4 down) | — | — | **Innings ends immediately (all out)**, even if it were mid-over | all-out short-circuits the over |

**Settings note (count changes):** if `playersPerSide` were changed **6 → 7** just before
this ball, the all-out threshold moves from 5 to 6 wickets — a wicket that *was* the last one
no longer ends the innings early; play continues to the overs limit. Conversely the overs
limit itself (e.g. changed **3 → 4**) moves which ball is "the last ball of the innings", so
this entire anchor shifts. See doc 08 §3.

**v1 vs v2:** identical end-of-innings state math. v1 shows an innings-break screen; v2 runs
its structured innings-break / second-innings-opening flow (openings selection again if
enabled).

---

## Anchor E — last ball of the match (second-innings run chase)

**Before-state**: Innings 2, chasing. Team A made **50**, so **target = 51** (need to *exceed*
50). Team B **49/4**, legal **17** → **2.5** in a 3-over match (final ball). On strike **P5**
15(12), non-striker **P6** 6(9). Bowler **B1** 2–22 (0.5). `playersPerSide = 6` → all out at
5 wkts (currently 4 down → one wicket from all out). **Need 2 to win, 1 to tie.**

**Key positional rule**: in innings 2 the match ends the instant the score **strictly
exceeds** the target (runs > 50), even mid-delivery-type. Reaching **exactly** 50 does not
win — it only ties *if* the innings simultaneously ends (overs complete / all out). A
**wide/no-ball is not legal**, so it can *win* the match (if it pushes runs past 50) but
cannot *end* it as a tie or loss (the ball is re-bowled).

| # | Outcome | Team | Legal | Match result |
|---|---|---|---|---|
| E-r0 | 0 (dot) | 49/4 | 3.0 | **Team A wins by 1 run** (innings ends on overs, 49 < 51) |
| E-r1 | 1 | 50/4 | 3.0 | **Match Tied** (innings ends, 50 = target−1, scores level) |
| E-r2 | 2 | 51/4 | — | **Team B wins by 1 wicket** (51 > 50 → ends the instant the run completes) |
| E-r4 | 4 | 53/4 | — | **Team B wins by 1 wicket** (target exceeded; extra runs recorded but result is by wickets) |
| E-r6 | 6 | 55/4 | — | **Team B wins by 1 wicket** |
| E-w1 | 1wd | 50/4 | 2.5 | **No result yet — match continues** (not legal, re-bowl; 50 not > 50) |
| E-w2 | 2wd | 51/4 | — | **Team B wins by 1 wicket** (a wide *can* win by pushing past target) |
| E-n0 | nb | 50/4 | 2.5 | **Match continues** (re-bowl; 50 not > 50) |
| E-n1 | nb+1 | 51/4 | — | **Team B wins by 1 wicket** |
| E-b1 | 1b | 50/4 | 3.0 | **Match Tied** (bye is legal → innings ends at 50, level) |
| E-l1 | 1lb | 50/4 | 3.0 | **Match Tied** |
| E-Wb | Bowled (0), 5th wicket | 49/5 | 3.0 | **Team A wins by 1 run** (all out at 49 < 51) |
| E-Ro1t | Run Out completing the **tying** run, then out (1 run, striker out for 2nd) | 50/5 | 3.0 | **Match Tied** (all out at 50 = level) |
| E-Ro0 | Run Out, 0 runs, 5th wicket | 49/5 | 3.0 | **Team A wins by 1 run** |

**Why these are worth explicit test cases:** the same physical outcome (a single) produces a
tie here but a routine run elsewhere; a wide produces "no result / continue" whereas a legal
dot on the same ball ends the match; and a wicket that *also* completes the tying run is a
tie, not a loss. These are exactly the ambiguous boundaries most likely to be mis-scored.

**Settings note:** if the match had been shortened (overs **3 → 2**) earlier, the "last ball"
would be a different delivery and this anchor moves. If `playersPerSide` were raised so the
batting side isn't one wicket from all out, the wicket rows (E-Wb/E-Ro0) would **not** end
the innings and play would continue.

**v1 vs v2:** result computation is identical. v2's structured flow still gates a new bowler
/ new batsman where applicable, but once the match-ending condition is met both versions go
straight to the result/scorecard.
