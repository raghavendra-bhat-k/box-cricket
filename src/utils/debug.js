import { getAllMatches, getAuditLog, getBalls } from '../db';

// The debug log is a SUPPORT-ONLY artifact. It bundles each guided (v2) match's
// audit trail together with a snapshot of the match and its balls so a developer
// can replay exactly what a user did offline. It is deliberately kept out of the
// normal sync/export path (see utils/sync.js) and is only produced on an explicit
// user action.

export const DEBUG_FORMAT = 'box-cricket-debug-log';
export const DEBUG_VERSION = 1;

// Audit event contract (payloads written by the v2 scoring flow in later phases):
//   matchCreated   { config }
//   tossSet        { toss }
//   openingSet     { openingSetup }
//   ballAdded      { ball }
//   ballEdited     { ball }        // full post-edit ball (matched by uid)
//   undo           { }            // removes the last replayed ball
//   redo           { ball }        // re-adds a previously undone ball
//   bowlerSelected / batsmanSelected / wicket / inningsBreak / matchEnded (informational)
//
// replayBallsFromAudit folds the event stream back into the ball list so the
// final state can be recomputed (e.g. via calculateScore) and compared against
// the live match — the core "replay to final state" debugging primitive.
export function replayBallsFromAudit(events = []) {
  const balls = [];
  for (const event of events) {
    const ball = event?.payload?.ball;
    switch (event?.action) {
      case 'ballAdded':
      case 'redo':
        if (ball) balls.push(ball);
        break;
      case 'undo':
        balls.pop();
        break;
      case 'ballEdited':
        if (ball) {
          const idx = ball.uid ? balls.findIndex(b => b.uid === ball.uid) : -1;
          if (idx >= 0) balls[idx] = ball;
        }
        break;
      default:
        // Non-ball events (match/toss/opening/informational) do not change the ball list.
        break;
    }
  }
  return balls;
}

// Gathers every match that has an audit log, with a snapshot needed for replay.
export async function buildDebugPayload() {
  const matches = await getAllMatches();
  const entries = [];
  for (const match of matches) {
    const auditLog = await getAuditLog(match.id);
    if (!auditLog.length) continue; // only guided (v2) matches keep an audit log
    const balls = [
      ...(await getBalls(match.id, 1)),
      ...(await getBalls(match.id, 2)),
    ];
    entries.push({ match, balls, auditLog });
  }
  return {
    format: DEBUG_FORMAT,
    version: DEBUG_VERSION,
    exportedAt: new Date().toISOString(),
    matchCount: entries.length,
    entries,
  };
}

export function makeDebugFile(payload) {
  const json = JSON.stringify(payload, null, 2);
  const stamp = (payload.exportedAt || new Date().toISOString()).replace(/[:.]/g, '-');
  return new File([json], `box-cricket-debug-${stamp}.json`, { type: 'application/json' });
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

// Builds and downloads/shares the debug file. Returns a small result describing
// what happened so the UI can give feedback.
export async function exportDebugLog() {
  const payload = await buildDebugPayload();
  if (payload.matchCount === 0) {
    return { status: 'empty', matchCount: 0 };
  }
  const file = makeDebugFile(payload);
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({
        title: 'Box Cricket debug log',
        text: 'Box Cricket support/debug log (not for normal import).',
        files: [file],
      });
      return { status: 'shared', matchCount: payload.matchCount };
    } catch (err) {
      if (err?.name === 'AbortError') return { status: 'cancelled', matchCount: payload.matchCount };
      downloadFile(file);
      return { status: 'downloaded', matchCount: payload.matchCount };
    }
  }
  downloadFile(file);
  return { status: 'downloaded', matchCount: payload.matchCount };
}
