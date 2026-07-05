import db, {
  createId,
  deleteBallsForMatch,
  getAllMatches,
  getBalls,
  getDayKey,
  getDeviceId,
  withBallSyncFields,
  withMatchSyncFields,
} from '../db';

export const SYNC_FORMAT = 'box-cricket-json-sync';
export const SYNC_VERSION = 1;

const MATCH_FIELDS = [
  'syncId', 'sourceSyncId', 'date', 'dayKey', 'status', 'teamA', 'teamB',
  'totalOvers', 'playersPerSide', 'teamASize', 'teamBSize', 'currentInnings',
  'result', 'rules', 'tournamentName', 'createdDeviceId', 'updatedAt',
];

const BALL_FIELDS = [
  'uid', 'sourceUid', 'matchSyncId', 'sequence', 'innings', 'over', 'ballInOver',
  'runs', 'isExtra', 'extraType', 'extraRuns', 'isWicket', 'dismissalType',
  'batsmanIndex', 'outBatsmanIndex', 'newBatsmanIndex', 'bowlerIndex', 'bowlerName', 'createdDeviceId', 'createdAt', 'updatedAt',
  'deletedAt',
];

function pick(obj, fields) {
  return Object.fromEntries(fields.map(field => [field, obj[field]]).filter(([, value]) => value !== undefined));
}

function slugify(value) {
  return String(value || 'sync')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'sync';
}

export function normalizeMatchForExport(match) {
  const normalized = withMatchSyncFields(match);
  return pick({
    ...normalized,
    dayKey: normalized.dayKey || getDayKey(normalized.date),
    tournamentName: normalized.tournamentName || '',
  }, MATCH_FIELDS);
}

export function normalizeBallForExport(ball, match = {}, index = 0) {
  const normalized = withBallSyncFields({
    ...ball,
    matchSyncId: ball.matchSyncId || match.syncId,
  }, ball.sequence ?? index);
  return pick(normalized, BALL_FIELDS);
}

export function buildSyncPayload({ scope, matches, balls, sourceDeviceId = getDeviceId() }) {
  const normalizedMatches = matches.map(normalizeMatchForExport);
  const matchByLocalId = new Map(matches.map((match, index) => [match.id, normalizedMatches[index]]));
  const matchBySyncId = new Map(normalizedMatches.map(match => [match.syncId, match]));
  return {
    format: SYNC_FORMAT,
    version: SYNC_VERSION,
    exportedAt: new Date().toISOString(),
    sourceDeviceId,
    scope,
    matches: normalizedMatches,
    balls: balls.map((ball, index) => {
      const match = matchBySyncId.get(ball.matchSyncId) || matchByLocalId.get(ball.matchId);
      return normalizeBallForExport(ball, match, index);
    }),
  };
}

export function parseSyncPayload(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('Selected file is not valid JSON.');
  }
  validateSyncPayload(payload);
  return payload;
}

export function validateSyncPayload(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Sync file is empty or invalid.');
  if (payload.format !== SYNC_FORMAT) throw new Error('This is not a Box Cricket sync file.');
  if (payload.version !== SYNC_VERSION) throw new Error('This sync file version is not supported.');
  if (!Array.isArray(payload.matches) || !Array.isArray(payload.balls)) {
    throw new Error('Sync file must include matches and balls.');
  }
  for (const match of payload.matches) {
    if (!match.teamA?.name || !match.teamB?.name || !match.date) {
      throw new Error('Sync file includes a match with missing team or date data.');
    }
  }
  const matchIds = new Set(payload.matches.map(match => match.syncId).filter(Boolean));
  for (const ball of payload.balls) {
    if (!ball.matchSyncId || !matchIds.has(ball.matchSyncId)) {
      throw new Error('Sync file includes a delivery that is not linked to an exported match.');
    }
    if (ball.innings == null || ball.runs == null) {
      throw new Error('Sync file includes a delivery with missing scoring data.');
    }
  }
}

export function getPayloadSummary(payload, localMatches = []) {
  const days = [...new Set(payload.matches.map(m => m.dayKey || getDayKey(m.date)))];
  const tournaments = [...new Set(payload.matches.map(m => m.tournamentName).filter(Boolean))];
  const statuses = payload.matches.reduce((acc, match) => {
    acc[match.status] = (acc[match.status] || 0) + 1;
    return acc;
  }, {});
  const localBySyncId = new Map(localMatches.map(match => [match.syncId, match]));
  const conflicts = payload.matches
    .map(match => {
      const local = localBySyncId.get(match.syncId);
      if (!local) return null;
      const localChanged = local.updatedAt && payload.exportedAt && local.updatedAt > payload.exportedAt;
      const remoteChanged = match.updatedAt && local.updatedAt && match.updatedAt !== local.updatedAt;
      return {
        syncId: match.syncId,
        teams: `${match.teamA.name} vs ${match.teamB.name}`,
        localId: local.id,
        divergent: Boolean(localChanged && remoteChanged),
      };
    })
    .filter(Boolean);
  const ballsByMatch = payload.balls.reduce((acc, ball) => {
    acc[ball.matchSyncId] = Math.max(acc[ball.matchSyncId] ?? -1, ball.sequence ?? 0);
    return acc;
  }, {});
  return {
    matchCount: payload.matches.length,
    ballCount: payload.balls.length,
    days,
    tournaments,
    statuses,
    conflicts,
    lastSequences: ballsByMatch,
    exportedAt: payload.exportedAt,
  };
}

export async function exportMatchPayload(matchId) {
  const match = await db.matches.get(matchId);
  if (!match) throw new Error('Match not found.');
  const b1 = await getBalls(matchId, 1);
  const b2 = await getBalls(matchId, 2);
  return buildSyncPayload({ scope: 'match', matches: [match], balls: [...b1, ...b2] });
}

export async function exportDayPayload(dayKey) {
  const matches = (await getAllMatches()).filter(match => (match.dayKey || getDayKey(match.date)) === dayKey);
  const balls = (await Promise.all(matches.map(async match => {
    const b1 = await getBalls(match.id, 1);
    const b2 = await getBalls(match.id, 2);
    return [...b1, ...b2];
  }))).flat();
  return buildSyncPayload({ scope: 'day', matches, balls });
}

export async function exportTournamentPayload(tournamentName) {
  const matches = (await getAllMatches()).filter(match => match.tournamentName === tournamentName);
  const balls = (await Promise.all(matches.map(async match => {
    const b1 = await getBalls(match.id, 1);
    const b2 = await getBalls(match.id, 2);
    return [...b1, ...b2];
  }))).flat();
  return buildSyncPayload({ scope: 'tournament', matches, balls });
}

export function getSyncFileName(payload) {
  if (payload.scope === 'day') {
    const day = payload.matches[0]?.dayKey || getDayKey(payload.matches[0]?.date);
    return `box-cricket-day-${day}.boxcricket.json`;
  }
  if (payload.scope === 'tournament') {
    const name = payload.matches[0]?.tournamentName || 'tournament';
    return `box-cricket-tournament-${slugify(name)}.boxcricket.json`;
  }
  const match = payload.matches[0];
  const teams = match ? `${slugify(match.teamA.name)}-v-${slugify(match.teamB.name)}` : 'match';
  const day = match?.dayKey || getDayKey(match?.date);
  return `box-cricket-match-${teams}-${day}.boxcricket.json`;
}

export function makeSyncFile(payload) {
  const json = JSON.stringify(payload, null, 2);
  const name = getSyncFileName(payload);
  return new File([json], name, { type: 'application/json' });
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function shareOrDownloadPayload(payload) {
  const file = makeSyncFile(payload);
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({
        title: 'Box Cricket sync file',
        text: 'Import this file in Box Cricket to continue scoring.',
        files: [file],
      });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      downloadFile(file);
      return 'downloaded';
    }
  }
  downloadFile(file);
  return 'downloaded';
}

function prepareImportedMatch(match, mode) {
  const cleaned = normalizeMatchForExport(match);
  if (mode === 'copy') {
    return withMatchSyncFields({
      ...cleaned,
      syncId: createId('match'),
      sourceSyncId: cleaned.syncId,
      updatedAt: new Date().toISOString(),
    });
  }
  return withMatchSyncFields(cleaned);
}

function prepareImportedBall(ball, importedMatch, localMatchId, index, mode) {
  const cleaned = normalizeBallForExport(ball, importedMatch, index);
  const copied = mode === 'copy';
  return withBallSyncFields({
    ...cleaned,
    matchId: localMatchId,
    matchSyncId: importedMatch.syncId,
    uid: copied ? createId('ball') : cleaned.uid,
    sourceUid: copied ? cleaned.uid : cleaned.sourceUid,
  }, cleaned.sequence ?? index);
}

export async function applySyncImport(payload, choices = {}) {
  validateSyncPayload(payload);
  const localMatches = await getAllMatches();
  const localBySyncId = new Map(localMatches.map(match => [match.syncId, match]));
  const imported = [];
  const skipped = [];

  for (const match of payload.matches) {
    const existing = localBySyncId.get(match.syncId);
    const mode = choices[match.syncId] || (existing ? 'skip' : 'import');
    if (mode === 'skip') {
      skipped.push(match.syncId);
      continue;
    }

    const importedMatch = prepareImportedMatch(match, mode);
    let localMatchId;
    if (mode === 'replace' && existing) {
      localMatchId = existing.id;
      await db.matches.update(localMatchId, importedMatch);
      await deleteBallsForMatch(localMatchId);
    } else {
      localMatchId = await db.matches.add(importedMatch);
    }

    const matchBalls = payload.balls
      .filter(ball => ball.matchSyncId === match.syncId)
      .sort((a, b) => (a.innings - b.innings) || ((a.sequence ?? 0) - (b.sequence ?? 0)));

    for (const [index, ball] of matchBalls.entries()) {
      await db.balls.add(prepareImportedBall(ball, importedMatch, localMatchId, index, mode));
    }
    imported.push({ syncId: importedMatch.syncId, localMatchId, mode });
  }

  return { imported, skipped };
}
