// Pure helpers for the in-play guided (v2) flow sequencing.
//
// The guided in-play steps are not held in an ephemeral queue; instead the
// "current step" is derived from state each render, which keeps the flow
// resume-safe (a mid-over-boundary reload re-derives the same pending step).

// True when the scorer must pick a bowler because an over just completed and
// they have not yet acknowledged the bowler for the upcoming over. `ackOver` is
// the over index the bowler has already been chosen for this session.
export function needsBowlerAtBoundary({ legalBalls, forceBowlerEachOver, ackOver }) {
  if (!forceBowlerEachOver) return false
  if (legalBalls <= 0 || legalBalls % 6 !== 0) return false
  const upcomingOver = legalBalls / 6
  return ackOver !== upcomingOver
}

// Resolves which full-screen in-play step to show, in priority order:
// capture the wicket details, then the incoming batsman, then the new bowler.
// Returns null when scoring should proceed normally.
export function currentInPlayStep({ wicketFlow, pendingNewBatsman, needBowler }) {
  if (wicketFlow) return 'wicket'
  if (pendingNewBatsman) return 'newBatsman'
  if (needBowler) return 'bowler'
  return null
}
