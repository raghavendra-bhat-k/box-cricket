import Dexie from 'dexie';

const db = new Dexie('BoxCricketDB');

db.version(1).stores({
  matches: '++id, date, status',
  balls: '++id, matchId, innings, over, ballInOver'
});

export default db;

export async function createMatch({ teamA, teamB, totalOvers, playersPerSide, teamAPlayers, teamBPlayers, rules }) {
  const matchId = await db.matches.add({
    date: new Date().toISOString(),
    status: 'live',
    teamA: { name: teamA, players: teamAPlayers || [] },
    teamB: { name: teamB, players: teamBPlayers || [] },
    totalOvers,
    playersPerSide,
    currentInnings: 1,
    result: null,
    rules: rules || null
  });
  return matchId;
}

export async function getMatch(id) {
  return db.matches.get(id);
}

export async function updateMatch(id, changes) {
  return db.matches.update(id, changes);
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
  return db.balls.add(ball);
}

export async function removeLastBall(matchId, innings) {
  const balls = await getBalls(matchId, innings);
  if (balls.length > 0) {
    const last = balls[balls.length - 1];
    await db.balls.delete(last.id);
    return last;
  }
  return null;
}

export async function updateBall(ballId, changes) {
  return db.balls.update(ballId, changes);
}

export async function getBallById(ballId) {
  return db.balls.get(ballId);
}
