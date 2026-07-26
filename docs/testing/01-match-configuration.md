# 01 — Match Configuration (`NewMatch.jsx`)

See [README.md](./README.md) for the status legend.

## Team names

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 1.1 | Both team names empty | "Start Match" stays disabled | ✅ `NewMatch.test.jsx` |
| 1.2 | Team A filled, Team B empty (or vice versa) | Start stays disabled | ✅ `NewMatch.test.jsx` |
| 1.3 | Team name is only whitespace | Treated as empty (`.trim()` check) — Start disabled | ⚠️ |
| 1.4 | Both names filled with valid text | Start enabled | ✅ |
| 1.5 | Very long team name (50+ chars) | Accepted, no truncation in form; verify downstream display doesn't overflow (Scorecard/MatchList) | ❌ |
| 1.6 | Team A field auto-focuses on screen open | Cursor starts in Team A input | ✅ |

## Overs per innings (`totalOvers`)

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 2.1 | Default value on fresh form | `6` | ✅ |
| 2.2 | Set to minimum `1` | Accepted | ✅ |
| 2.3 | Set to maximum `50` | Accepted | ⚠️ |
| 2.4 | Attempt value `0` or negative | Should be blocked/clamped by `min="1"` — verify actual browser/input behavior, since HTML `min` doesn't hard-block typed values | ❌ |
| 2.5 | Attempt value `51`+ | Should be blocked/clamped by `max="50"` — same caveat as 2.4 | ❌ |
| 2.6 | Non-numeric input | Number input should reject/ignore non-numeric chars | ❌ |

## Players per side (`playersPerSide`)

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 3.1 | Default value on fresh form | `6` | ✅ |
| 3.2 | Set to minimum `2` | Accepted | ✅ |
| 3.3 | Set to maximum `11` | Accepted | ⚠️ |
| 3.4 | Out-of-range values (`1`, `12`+) | Should be blocked/clamped by `min="2"`/`max="11"` | ❌ |
| 3.5 | Change `playersPerSide` after adding player names | Player name slots resize via `ensurePlayerSlots` (pad/truncate) | ✅ |

## Player name entry (optional)

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 4.1 | Toggle "Add Player Names" on | Reveals per-team name inputs, count = `playersPerSide` | ✅ |
| 4.2 | Toggle off after entering names | Names section hides; verify entered names are/aren't discarded on submit | ⚠️ |
| 4.3 | Leave some name fields blank | Blank names filtered out on submit (not stored as empty strings) | ✅ |
| 4.4 | Fill fewer names than `playersPerSide` | Match created with partial roster; remaining slots handled downstream in Scoring (auto-numbered players) | ⚠️ |
| 4.5 | Duplicate player names within a team | Accepted (no uniqueness validation) — verify Scoring UI disambiguates correctly by index, not name | ❌ |

## Custom scoring rules (optional)

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 5.1 | Toggle "Custom Scoring Rules" on | Reveals table of tap values 0,1,2,3,4,6 with Enabled checkbox + "Records as" input | ✅ |
| 5.2 | Disable one run value (e.g. disable `3`) | `disabledRuns` includes `3`; that button hidden in Scoring run grid | ✅ |
| 5.3 | Remap a tap value (e.g. tap `4` records as `5`) | `runMap` stores `{4: 5}` only since it differs from the tap value; Scoring shows label `4→5` | ✅ |
| 5.4 | Set "Records as" to same value as the tap | Not stored in `runMap` (only divergent mappings persisted) | ⚠️ |
| 5.5 | Set "Records as" to boundary values `0` and `12` | Accepted per `min="0" max="12"` | ❌ |
| 5.6 | Disable all run values | Verify Scoring screen still allows extras/wicket entry even with an empty run grid (degenerate case) | ❌ |
| 5.7 | No rules customized at all | `rules` object omitted entirely from the created match (not stored as empty object) | ✅ |

## Rematch flow

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 6.1 | Rematch from a completed match | Pre-fills `teamA`, `teamB`, `tournamentName`, `totalOvers`, `playersPerSide`, both player rosters, and `rules` | ✅ |
| 6.2 | Rematch from a match that had player names | Player-names section auto-expanded/shown | ✅ |
| 6.3 | Rematch from a match that had custom rules | Custom-rules section auto-expanded/shown | ✅ |
| 6.4 | Rematch from a match with neither names nor rules | Both optional sections stay collapsed by default | ⚠️ |
| 6.5 | Tap "⇅ Swap Batting Order" on rematch | Team A/B names and player rosters swap; button only visible in rematch mode | ✅ |
| 6.6 | Rematch of a `appVersion:1` match | Routes to `createMatch` (v1) on submit | ✅ |
| 6.7 | Rematch of a `appVersion:2` match | Routes to `createMatchV2` (v2, adds audit log entry) | ✅ |
| 6.8 | Edit pre-filled fields before starting rematch | Edited values used, not the original match's values | ⚠️ |

## Tournament / day label

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 7.1 | Leave "Tournament / Day Label" blank | Match falls back to day-based grouping (`dayKey`) in `MatchList` | ✅ |
| 7.2 | Fill in a tournament name | Match groups under that tournament name in `MatchList`, spanning multiple days if reused | ✅ |
| 7.3 | Two different matches, same tournament name, different days | Grouped together under one tournament heading | ⚠️ |
