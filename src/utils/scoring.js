// Dismissals credited to the bowler. Run out, retired, obstructing the field and
// timed out are charged to the team only (not the bowler). A null/undefined type
// is treated as bowler-credited for backward compatibility with legacy balls.
const BOWLER_CREDITED_DISMISSALS = new Set([
  'bowled', 'caught', 'lbw', 'stumped', 'hit wicket',
])

export function calculateScore(balls) {
  let runs = 0;
  let wickets = 0;
  let legalBalls = 0;
  let extras = { wides: 0, noBalls: 0, byes: 0, legByes: 0 };
  const batsmen = {};
  const bowlers = {};

  for (const ball of balls) {
    const totalRuns = ball.runs + (ball.extraRuns || 0);
    runs += totalRuns;

    if (ball.isExtra) {
      if (ball.extraType === 'wide') {
        extras.wides += totalRuns;
        // wide doesn't count as legal ball
      } else if (ball.extraType === 'noBall') {
        extras.noBalls += (ball.extraRuns || 0);
        // no ball doesn't count as legal ball
      } else {
        // bye/legBye is a legal ball
        if (ball.extraType === 'bye') extras.byes += ball.runs;
        if (ball.extraType === 'legBye') extras.legByes += ball.runs;
        legalBalls++;
      }
    } else {
      legalBalls++;
    }

    if (ball.isWicket) wickets++;

    // Track batsman stats
    const batKey = ball.batsmanIndex;
    if (batKey !== undefined) {
      if (!batsmen[batKey]) {
        batsmen[batKey] = { runs: 0, balls: 0, fours: 0, sixes: 0, howOut: 'not out' };
      }
      if (!ball.isExtra || ball.extraType === 'noBall') {
        batsmen[batKey].runs += ball.runs;
      }
      // Count ball faced (not on wides)
      if (!ball.isExtra || ball.extraType !== 'wide') {
        batsmen[batKey].balls++;
      }
      if ((!ball.isExtra || ball.extraType === 'noBall') && ball.runs === 4) batsmen[batKey].fours++;
      if ((!ball.isExtra || ball.extraType === 'noBall') && ball.runs === 6) batsmen[batKey].sixes++;
    }

    // Attribute the dismissal to whoever was out — for run-outs this can be the
    // non-striker, so use outBatsmanIndex when present (falls back to the striker).
    if (ball.isWicket) {
      const outKey = ball.outBatsmanIndex ?? ball.batsmanIndex;
      if (outKey !== undefined) {
        if (!batsmen[outKey]) {
          batsmen[outKey] = { runs: 0, balls: 0, fours: 0, sixes: 0, howOut: 'not out' };
        }
        batsmen[outKey].howOut = ball.dismissalType || 'out';
      }
    }

    // Track bowler stats — key by name when available for unified multi-spell rows
    const bowlKey = ball.bowlerName !== undefined ? ball.bowlerName : ball.bowlerIndex;
    if (bowlKey !== undefined) {
      if (!bowlers[bowlKey]) {
        bowlers[bowlKey] = { balls: 0, runs: 0, wickets: 0, index: ball.bowlerIndex };
      }
      bowlers[bowlKey].runs += totalRuns;
      if (!ball.isExtra || (ball.extraType !== 'wide' && ball.extraType !== 'noBall')) {
        bowlers[bowlKey].balls++;
      }
      if (ball.isWicket && (ball.dismissalType == null || BOWLER_CREDITED_DISMISSALS.has(ball.dismissalType))) {
        bowlers[bowlKey].wickets++;
      }
    }
  }

  const overs = Math.floor(legalBalls / 6);
  const ballsInOver = legalBalls % 6;

  return { runs, wickets, legalBalls, overs, ballsInOver, extras, batsmen, bowlers };
}

export function formatOvers(legalBalls) {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}

export function calculateRR(runs, legalBalls) {
  if (legalBalls === 0) return '0.00';
  const overs = legalBalls / 6;
  return (runs / overs).toFixed(2);
}

export function calculateRequiredRR(target, currentRuns, legalBalls, totalOvers) {
  const totalBalls = totalOvers * 6;
  const remainingBalls = totalBalls - legalBalls;
  if (remainingBalls <= 0) return '-';
  const remainingOvers = remainingBalls / 6;
  const runsNeeded = target - currentRuns;
  return (runsNeeded / remainingOvers).toFixed(2);
}

export function getCurrentOver(balls) {
  // Get balls in the current (last) over
  let legalCount = 0;
  const currentOverBalls = [];

  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    if (!b.isExtra || (b.extraType !== 'wide' && b.extraType !== 'noBall')) {
      legalCount++;
    }
    // We're working backwards; once we've gone past 6 legal balls
    // from the end, the rest belongs to previous overs
    currentOverBalls.unshift(b);
    if (legalCount >= 6) break;
  }

  // Actually we need to find where the current over starts
  // Simpler: count legal balls total, find over boundary
  let totalLegal = 0;
  for (const b of balls) {
    if (!b.isExtra || (b.extraType !== 'wide' && b.extraType !== 'noBall')) {
      totalLegal++;
    }
  }
  const completedOvers = Math.floor(totalLegal / 6);
  const overStart = completedOvers * 6;

  // Walk through balls counting legal deliveries to find the start index
  let legal = 0;
  let startIdx = 0;
  for (let i = 0; i < balls.length; i++) {
    if (legal >= overStart) {
      startIdx = i;
      break;
    }
    const b = balls[i];
    if (!b.isExtra || (b.extraType !== 'wide' && b.extraType !== 'noBall')) {
      legal++;
    }
    startIdx = i + 1;
  }

  return balls.slice(startIdx);
}

export function ballDisplay(ball) {
  if (ball.isWicket) return ball.runs > 0 ? `W${ball.runs}` : 'W';
  if (ball.isExtra) {
    const prefix = ball.extraType === 'wide' ? 'Wd' :
                   ball.extraType === 'noBall' ? 'Nb' :
                   ball.extraType === 'bye' ? 'B' : 'Lb';
    return `${prefix}${ball.runs + (ball.extraRuns || 0)}`;
  }
  if (ball.runs === 0) return '.';
  return String(ball.runs);
}

// Reconstruct striker, nonStriker, bowlerIdx from ball history (for resume)
export function restoreStateFromBalls(ballHistory) {
  let s = 0, ns = 1, bowler = 0
  let legalBalls = 0

  for (const ball of ballHistory) {
    const isLegal = !ball.isExtra || (ball.extraType !== 'wide' && ball.extraType !== 'noBall')

    // tapRuns = physical runs before mapping (stored in ball). Fall back to ball.runs for backward compat.
    const physicalRuns = ball.tapRuns !== undefined ? ball.tapRuns : ball.runs
    // Wide: penalty extra never rotates strike — only batsman's own runs (always 0) count
    // No-ball: only batsman's physical runs count (exclude 1-run penalty)
    // Bye/LegBye/Normal: total of runs + extraRuns counts
    const runsForSwap = (ball.isExtra && ball.extraType === 'wide')
      ? ball.runs
      : (ball.isExtra && ball.extraType === 'noBall')
        ? physicalRuns
        : physicalRuns + (ball.extraRuns || 0)

    // Odd completed runs cross the batsmen — applies to run-outs too (the runs
    // taken before the run-out physically swap the ends).
    if (runsForSwap % 2 === 1) {
      ;[s, ns] = [ns, s]
    }

    // Wicket: the new batsman comes in at the end the dismissed batsman vacated.
    // For run-outs the non-striker can be out, so honour outBatsmanIndex.
    if (ball.isWicket) {
      const outIdx = ball.outBatsmanIndex ?? ball.batsmanIndex
      const next = Math.max(s, ns) + 1
      if (ns === outIdx) ns = next
      else s = next // striker out, or unknown out index
    }

    if (isLegal) legalBalls++

    // End of over: strike rotates regardless of a wicket falling on the last ball,
    // so the not-out batsman takes strike for the next over.
    if (legalBalls > 0 && legalBalls % 6 === 0 && isLegal) {
      ;[s, ns] = [ns, s]
      bowler++
    }
  }

  return { striker: s, nonStriker: ns, bowlerIdx: bowler }
}
