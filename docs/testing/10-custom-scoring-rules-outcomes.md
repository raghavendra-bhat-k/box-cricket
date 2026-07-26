# 10 — Custom Scoring Rules: Ball Outcome Effects

Docs 07–09 assume the **tapped** run value equals the **recorded** run value. This app's
optional **custom scoring rules** (configured in `NewMatch`, see doc 01 §5) break that
assumption in two ways, which changes the after-state of many ball outcomes:

- **`runMap`** — remap a tapped value to a different recorded value (e.g. tap `1` → records `2`).
- **`disabledRuns`** — hide a run button entirely (that outcome is unreachable off the bat).

This document is the "expected" (oracle) side, per the feature's own contract — which the
user articulated directly: *a tap of 1 that records as 2 should add 2 runs, but the batsmen
change strike as if 1 was run.* Whether the implementation matches, and what's tested, is in
doc 09 (rows referenced below). Only the run buttons the app actually offers can be remapped:
`0, 1, 2, 3, 4, 6`.

## The contract (what "custom rules" should do to a ball)

For a run scored off the bat with a `runMap` entry `tap → recorded`:

| Aspect | Driven by |
|---|---|
| Team score increment | **recorded** value |
| Striker's runs credited | **recorded** value |
| Fours / sixes tally | **recorded** value (counts as a four iff recorded == 4, a six iff recorded == 6) |
| Bowler's runs conceded | **recorded** value |
| Ball faced, legal-ball count | unchanged (always +1 each — it's a normal legal delivery) |
| **Strike rotation** | **tapped** value's parity (odd tap → swap ends) |

The split between "score by recorded, rotate by tapped" is the whole point of the feature and
the main source of non-obvious scenarios.

## Anchor A with custom rules applied

Reuses **Anchor A** from doc 07: Team **40/2**, legal **2.2**, on strike **P3** 20(15) with
2 fours / 1 six, non-striker **P4** 8(10), bowler **B2** 1–18 (1.2).

| # | Rule | Tap | Team | On strike after | Bowler | 4s/6s Δ | Rot? | Why it's interesting |
|---|---|---|---|---|---|---|---|---|
| 10.1 | `{1: 2}` | 1 | 42/2 | →P4 8(10) | 1–20 (1.3) | — | **Y** | The user's case: scores 2, but rotates because the *tap* (1) is odd |
| 10.2 | `{2: 3}` | 2 | 43/2 | →P3 23(16) | 1–21 (1.3) | — | **N** | Inverse surprise: scores an odd 3 but **keeps** strike (tap 2 is even) |
| 10.3 | `{3: 4}` | 3 | 44/2 | →P4 8(10) | 1–22 (1.3) | **4s→3** | **Y** | Counts as a four (recorded == 4) **and** rotates strike — unlike a real 4, which never rotates |
| 10.4 | `{4: 5}` | 4 | 45/2 | →P3 25(16) | 1–23 (1.3) | — | **N** | Scores 5 but is **not** a four (recorded == 5); tap 4 is even so no rotation |
| 10.5 | `{6: 4}` | 6 | 44/2 | →P3 24(16) | 1–22 (1.3) | **4s→3** | **N** | Tapping the "6" button records a four (recorded == 4) and increments the fours tally; tap 6 is even, no rotation |
| 10.6 | `{1: 0}` | 1 | 40/2 | →P4 8(10) | 1–18 (1.3) | — | **Y** | A scoreless ball that still **swaps strike** (tap 1 odd) — a "dot that rotates" |
| 10.7 | `{2: 0}` | 2 | 40/2 | →P3 20(16) | 1–18 (1.3) | — | **N** | A dot-equivalent with no rotation (tap 2 even) — behaves like a plain dot |

## No-ball combined with `runMap`

A no-ball's batsman-run picker is also mapped: recorded = `getMappedRuns(tap)`, penalty +1,
rotation on the *tapped* batsman runs. Anchor A, rule `{1: 2}`:

| # | Rule | No-ball tap | Team | On strike after | Extras Δ | Rot? |
|---|---|---|---|---|---|---|
| 10.8 | `{1: 2}` | nb, batsman taps 1 | 43/2 (+2 recorded +1 penalty) | →P4 8(10) | Nb→2 | **Y** (tapped 1 is odd) |
| 10.9 | `{2: 3}` | nb, batsman taps 2 | 44/2 (+3 recorded +1 penalty) | →P3 22(16) | Nb→2 | **N** (tapped 2 is even) |

## `disabledRuns`

| # | Rule | Effect |
|---|---|---|
| 10.10 | `disabledRuns: [3]` | The "3" button is hidden in the run grid; **3 runs off the bat is unreachable via a tap**. (The v1 main run grid has no custom "+" input, so a disabled value has no alternate entry path — unlike extras/no-ball/wicket pickers, which do.) |
| 10.11 | `disabledRuns: [3]` **+** `runMap: {2: 3}` | 3 is still reachable *indirectly* — tapping the enabled "2" records 3. Disabling a value only removes its own button, not other taps that map onto it. |
| 10.12 | Disable every run value | Degenerate: the run grid is empty; only extras and wicket entry remain. Verify the screen doesn't break and a match can still (barely) progress via extras only. |

## Interaction with the positional anchors (docs 07 B–E)

The mapping/rotation split composes with every positional anchor:

- **Last ball of over (Anchor C)**: rotation is still decided by the *tapped* parity, then the
  over-end swap applies on top. Worked example: rule `{1: 2}`, tap 1 on the 6th ball — the tap
  (odd) rotates once, the over-end rotates again → they cancel, so the same batsman is on
  strike for the next over, having scored 2.
- **Last ball of match (Anchor E)**: the **recorded** value is what counts toward the target.
  Worked example: need 2 to win, rule `{1: 2}`, batsman taps 1 → records 2 → **target exceeded,
  match won**, even though only a "single" was physically run. Conversely rule `{2: 1}` (tap 2
  records 1) with 2 needed would *not* win on a tap of 2.

## Version note (v1 / v2)

`runMap` / `disabledRuns` are stored on the match and applied identically by both `Scoring.jsx`
(v1) and `ScoringV2.jsx` (v2) — `getMappedRuns` and the `tapRuns`-based rotation exist in both.
No version-specific behavioral difference for custom rules; the scenarios above apply to both.

## Coverage pointer

The engine-level rotation-on-`tapRuns` behavior is tested (`scoring.test.js` "run mapping"
block, incl. no-ball). The **batsman run/four/six crediting under mapping** (rows 10.3, 10.4,
10.5 — does a mapped-to-4 count as a four, does a mapped-off-4 stop counting) and the
`disabledRuns` reachability cases (10.10–10.12) are **not** covered — see doc 09 Part B.
