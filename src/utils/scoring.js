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
        extras.noBalls += totalRuns;
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
        // Batsman gets credited runs on normal balls and no-balls
        if (!ball.isExtra) {
          batsmen[batKey].runs += ball.runs;
        }
      }
      // Count ball faced (not on wides)
      if (!ball.isExtra || ball.extraType !== 'wide') {
        batsmen[batKey].balls++;
      }
      if (!ball.isExtra && ball.runs === 4) batsmen[batKey].fours++;
      if (!ball.isExtra && ball.runs === 6) batsmen[batKey].sixes++;
      if (ball.isWicket) {
        batsmen[batKey].howOut = ball.dismissalType || 'out';
      }
    }

    // Track bowler stats
    const bowlKey = ball.bowlerIndex;
    if (bowlKey !== undefined) {
      if (!bowlers[bowlKey]) {
        bowlers[bowlKey] = { balls: 0, runs: 0, wickets: 0 };
      }
      bowlers[bowlKey].runs += totalRuns;
      if (!ball.isExtra || (ball.extraType !== 'wide' && ball.extraType !== 'noBall')) {
        bowlers[bowlKey].balls++;
      }
      if (ball.isWicket) bowlers[bowlKey].wickets++;
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
  if (ball.isWicket) return 'W';
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
    const totalRuns = ball.runs + (ball.extraRuns || 0)

    // Strike rotation for odd runs (excluding wickets)
    if (!ball.isWicket && totalRuns % 2 === 1) {
      ;[s, ns] = [ns, s]
    }

    // Wicket: new batsman comes in at striker's end
    if (ball.isWicket) {
      s = Math.max(s, ns) + 1
    }

    if (isLegal) legalBalls++

    // End of over: swap strike + new bowler
    if (legalBalls > 0 && legalBalls % 6 === 0 && isLegal) {
      if (!ball.isWicket) {
        ;[s, ns] = [ns, s]
      }
      bowler++
    }
  }

  return { striker: s, nonStriker: ns, bowlerIdx: bowler }
}
