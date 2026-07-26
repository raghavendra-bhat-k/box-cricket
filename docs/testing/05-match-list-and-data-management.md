# 05 — Match List & Data Management (`MatchList.jsx`, `db.js`, sync)

See [README.md](./README.md) for the status legend.

## Grouping & listing

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 1.1 | Matches with a `tournamentName` set | Grouped under that tournament heading | ✅ |
| 1.2 | Matches without a `tournamentName` | Grouped by `dayKey` (date) instead | ✅ |
| 1.3 | Groups sorted latest-first | ✅ | ✅ |
| 1.4 | Today's group (or the first group if none is today) | Auto-expanded on load | ✅ |
| 1.5 | Other groups | Collapsed by default, expandable on tap | ✅ |
| 1.6 | No matches exist yet | Empty state shown, offers "Import Sync File" | ✅ |
| 1.7 | Match status label | `live` → "In Progress"; else shows `result` text or "Completed" | ✅ |

## Per-match actions

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 2.1 | "Resume" button | Shown only for `live` matches | ✅ |
| 2.2 | "Rematch" button | Shown only when the match's date `isToday(m.date)` — hidden for older matches | ✅ |
| 2.3 | Rematch attempted on a match from a previous day | Button not rendered — verify there's no other path to trigger rematch on old matches | ⚠️ |
| 2.4 | "View" button | Opens Scorecard for the match (live or completed) | ✅ |
| 2.5 | "Export" (single match) | Produces a sync file for just that match | ✅ |
| 2.6 | "Delete" (single match) | `window.confirm` guard, then cascades delete of the match's balls and audit log | ✅ |
| 2.7 | Cancel the delete confirm dialog | Match remains untouched | ⚠️ |

## Group-level actions

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 3.1 | Group-level Export | Exports all matches in that tournament/day group | ✅ |
| 3.2 | Group-level Import | Merges an external sync file's matches into this group | ✅ |
| 3.3 | Group-level Delete | Deletes all matches (and their balls/audit) in the group, with confirmation | ✅ |
| 3.4 | Import a sync file with matches that already exist locally (same `syncId`) | Merge logic reconciles rather than duplicating — verify `sequence`/`updatedAt` conflict resolution | ⚠️ |
| 3.5 | Import a sync file containing a soft-deleted ball (`deletedAt` set) | Deletion is honored/replayed locally, not resurrected | ❌ |
| 3.6 | Import a sync file from a different device (`createdDeviceId` differs) | Imported cleanly, device attribution preserved | ⚠️ |

## Dexie schema / `db.js`

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 4.1 | Fresh install, DB created at v2 | Both `matches` and `balls` and `auditLog` tables exist | ✅ |
| 4.2 | Existing v1 database upgraded to v2 | `auditLog` table added via Dexie migration without data loss on `matches`/`balls` | ✅ |
| 4.3 | Old match record missing `teamASize`/`teamBSize` (pre-dates the field) | Falls back via `match.teamASize ?? match.playersPerSide` per CLAUDE.md convention | ⚠️ |
| 4.4 | `deleteMatch` on a match with balls and audit entries | Cascades: match + all its balls + all its audit entries removed | ✅ |
| 4.5 | `addBall` / `removeLastBall` / `updateBall` / `deleteBall` direct calls | Correct CRUD against `balls` table | ✅ |
| 4.6 | `getBalls` ordering | Sorted by `id` (insertion order), not by over/ballInOver fields | ✅ |
| 4.7 | `appendAudit` | Sequence number (`seq`) increments per-match, not globally | ✅ |
| 4.8 | `auditLog` excluded from sync/export payloads | Confirmed — audit entries are local-only, not shared via sync file | ⚠️ |
| 4.9 | Match created via `createMatch` (v1) vs `createMatchV2` | `appVersion` field set to `1` vs `2` respectively; v2 also writes an initial `matchCreated` audit entry | ✅ |
