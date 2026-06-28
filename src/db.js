import Dexie from 'dexie';

const db = new Dexie('BoxCricketDB');

db.version(1).stores({
  matches: '++id, date, status',
  balls: '++id, matchId, innings, over, ballInOver'
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

export async function createMatch({ teamA, teamB, totalOvers, playersPerSide, teamAPlayers, teamBPlayers, rules, tournamentName }) {
  const date = new Date().toISOString();
  const matchId = await db.matches.add({
    ...withMatchSyncFields({
      date,
      status: 'live',
      teamA: { name: teamA, players: teamAPlayers || [] },
      teamB: { name: teamB, players: teamBPlayers || [] },
      totalOvers,
      playersPerSide,
      teamASize: playersPerSide,
      teamBSize: playersPerSide,
      currentInnings: 1,
      result: null,
      rules: rules || null,
      tournamentName: tournamentName?.trim() || '',
    }),
  });
  return matchId;
}

export async function getMatch(id) {
  return db.matches.get(id);
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
