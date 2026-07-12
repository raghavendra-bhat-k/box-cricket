import Dexie from 'dexie';

const db = new Dexie('BoxCricketDB');

db.version(1).stores({
  matches: '++id, date, status',
  balls: '++id, matchId, innings, over, ballInOver'
});

// Version 2 adds the auditLog store used by the v2 (guided) scoring experience.
// It records every mutation so a match can be replayed for offline/support debugging.
// This store is intentionally kept OUT of the sync/export path (see utils/sync.js).
db.version(2).stores({
  matches: '++id, date, status',
  balls: '++id, matchId, innings, over, ballInOver',
  auditLog: '++id, matchId, seq'
});

export default db;

export function createId(prefix = 'id') {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${random}`;
}

export function getDayKey(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDeviceId() {
  const key = 'boxCricketDeviceId';
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const created = createId('device');
    localStorage.setItem(key, created);
    return created;
  } catch {
    return createId('device');
  }
}

export function withMatchSyncFields(match) {
  const date = match.date || new Date().toISOString();
  const now = new Date().toISOString();
  return {
    ...match,
    date,
    syncId: match.syncId || createId('match'),
    dayKey: match.dayKey || getDayKey(date),
    tournamentName: match.tournamentName || '',
    // v2 (guided scoring) fields — default to the v1 shape for backward compatibility.
    appVersion: match.appVersion ?? 1,
    toss: match.toss ?? null,
    openingSetup: match.openingSetup ?? null,
    createdDeviceId: match.createdDeviceId || getDeviceId(),
    updatedAt: match.updatedAt || now,
  };
}

export function withBallSyncFields(ball, sequence) {
  const now = new Date().toISOString();
  return {
    ...ball,
    uid: ball.uid || createId('ball'),
    matchSyncId: ball.matchSyncId || null,
    sequence: ball.sequence ?? sequence ?? 0,
    createdDeviceId: ball.createdDeviceId || getDeviceId(),
    createdAt: ball.createdAt || now,
    updatedAt: ball.updatedAt || now,
    deletedAt: ball.deletedAt ?? null,
  };
}

export async function createMatch({ teamA, teamB, totalOvers, playersPerSide, teamAPlayers, teamBPlayers, teamABowlingOrder, teamBBowlingOrder, rules, tournamentName, appVersion, toss, openingSetup }) {
  const date = new Date().toISOString();
  const matchId = await db.matches.add({
    ...withMatchSyncFields({
      date,
      status: 'live',
      teamA: { name: teamA, players: teamAPlayers || [], bowlingOrder: teamABowlingOrder || [...(teamAPlayers || [])] },
      teamB: { name: teamB, players: teamBPlayers || [], bowlingOrder: teamBBowlingOrder || [...(teamBPlayers || [])] },
      totalOvers,
      playersPerSide,
      teamASize: playersPerSide,
      teamBSize: playersPerSide,
      currentInnings: 1,
      result: null,
      rules: rules || null,
      tournamentName: tournamentName?.trim() || '',
      appVersion: appVersion ?? 1,
      toss: toss ?? null,
      openingSetup: openingSetup ?? null,
    }),
  });
  return matchId;
}

// Creates a match tagged for the v2 guided-scoring experience and records the
// first audit event so the match can be replayed from creation.
export async function createMatchV2(config) {
  const matchId = await createMatch({ ...config, appVersion: 2 });
  await appendAudit({ matchId, action: 'matchCreated', payload: { config: { ...config, appVersion: 2 } } });
  return matchId;
}

export async function getMatch(id) {
  return db.matches.get(id);
}

// --- Audit log (v2 guided scoring; excluded from sync/export) ---

// Appends an immutable, ordered event for a match. `seq` is assigned per-match
// so the log can be replayed in order regardless of the global auto-increment id.
export async function appendAudit({ matchId, action, payload = null, stepId = null }) {
  const count = await db.auditLog.where({ matchId }).count();
  return db.auditLog.add({
    matchId,
    seq: count,
    ts: new Date().toISOString(),
    action,
    payload,
    stepId,
  });
}

export async function getAuditLog(matchId) {
  return db.auditLog.where({ matchId }).sortBy('seq');
}

export async function deleteAuditLog(matchId) {
  return db.auditLog.where({ matchId }).delete();
}

export async function updateMatch(id, changes) {
  return db.matches.update(id, {
    ...changes,
    ...(changes.date ? { dayKey: getDayKey(changes.date) } : {}),
    updatedAt: new Date().toISOString(),
  });
}

export async function getAllMatches() {
  return db.matches.orderBy('date').reverse().toArray();
}

export async function getBalls(matchId, innings) {
  return db.balls
    .where({ matchId, innings })
    .sortBy('id');
}

export async function addBall(ball) {
  const match = ball.matchSyncId ? null : await db.matches.get(ball.matchId);
  const balls = await getBalls(ball.matchId, ball.innings);
  const syncedBall = withBallSyncFields({
    ...ball,
    matchSyncId: ball.matchSyncId || match?.syncId || null,
  }, balls.length);
  const id = await db.balls.add(syncedBall);
  if (ball.matchId) await updateMatch(ball.matchId, {});
  return id;
}

export async function removeLastBall(matchId, innings) {
  const balls = await getBalls(matchId, innings);
  if (balls.length > 0) {
    const last = balls[balls.length - 1];
    await db.balls.delete(last.id);
    await updateMatch(matchId, {});
    return last;
  }
  return null;
}

// Deletes a single ball by id (used by the v2 edit-ball flow). State is re-derived
// from the remaining ball log, so removing a mid-innings ball is safe.
export async function deleteBall(ballId) {
  const ball = await db.balls.get(ballId);
  await db.balls.delete(ballId);
  if (ball?.matchId) await updateMatch(ball.matchId, {});
  return ball;
}

export async function updateBall(ballId, changes) {
  const ball = await db.balls.get(ballId);
  const result = await db.balls.update(ballId, { ...changes, updatedAt: new Date().toISOString() });
  if (ball?.matchId) await updateMatch(ball.matchId, {});
  return result;
}

export async function getBallById(ballId) {
  return db.balls.get(ballId);
}

export async function deleteBallsForMatch(matchId) {
  return db.balls.where({ matchId }).delete();
}

export async function deleteMatch(matchId) {
  await deleteBallsForMatch(matchId);
  await deleteAuditLog(matchId);
  return db.matches.delete(matchId);
}

export async function deleteMatchesByDay(dayKey) {
  const matches = (await getAllMatches()).filter(match => (match.dayKey || getDayKey(match.date)) === dayKey);
  for (const match of matches) {
    await deleteMatch(match.id);
  }
  return matches.length;
}

export async function deleteMatchesByTournament(tournamentName) {
  const matches = (await getAllMatches()).filter(match => match.tournamentName === tournamentName);
  for (const match of matches) {
    await deleteMatch(match.id);
  }
  return matches.length;
}
