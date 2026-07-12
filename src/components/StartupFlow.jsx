import { useState } from 'react'
import FlowOverlay from './FlowOverlay'
import PlayerPicker from './PlayerPicker'

// Derives which team bats first from the toss result.
export function resolveBattingFirst(wonBy, decision) {
  if (decision === 'bat') return wonBy
  return wonBy === 'A' ? 'B' : 'A'
}

function pad(names = [], size) {
  const out = []
  for (let i = 0; i < Math.max(names.length, size); i++) out.push(names[i] || '')
  return out
}

// StartupFlow renders the guided pre-match steps as full-screen overlays and
// only appears while a startup step is still pending. Whether a step is pending
// is derived from persisted match state (match.toss / match.openingSetup) so the
// flow survives a resume: once a step is saved it is never shown again.
//
// Persistence is delegated to the parent (ScoringV2) via onToss / onOpenings so
// audit logging and DB writes stay in one place.
export default function StartupFlow({ match, settings, onToss, onOpenings }) {
  const [toss, setToss] = useState({ wonBy: null, decision: null })
  const [phase, setPhase] = useState('striker') // 'striker' | 'nonStriker' | 'bowler'
  const [opening, setOpening] = useState({ striker: null, nonStriker: null, bowlerIndex: null })
  const [names, setNames] = useState({ batting: {}, bowling: {} })

  const needToss = settings.toss !== false && !match.toss
  const needOpenings = settings.openingBatsmen !== false && !match.openingSetup

  // ── Toss ──────────────────────────────────────────────
  if (needToss) {
    const canConfirm = toss.wonBy && toss.decision
    return (
      <FlowOverlay title="Toss" subtitle="Who won the toss, and what did they choose?">
        <p className="flow-label">Toss won by</p>
        <div className="flow-options">
          {['A', 'B'].map(side => (
            <button
              key={side}
              className={`flow-option${toss.wonBy === side ? ' selected' : ''}`}
              onClick={() => setToss(t => ({ ...t, wonBy: side }))}
            >
              {side === 'A' ? match.teamA.name : match.teamB.name}
            </button>
          ))}
        </div>
        <p className="flow-label">Elected to</p>
        <div className="flow-options">
          {[['bat', 'Bat'], ['bowl', 'Bowl']].map(([val, label]) => (
            <button
              key={val}
              className={`flow-option${toss.decision === val ? ' selected' : ''}`}
              onClick={() => setToss(t => ({ ...t, decision: val }))}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="btn btn-primary btn-large flow-confirm"
          disabled={!canConfirm}
          onClick={() => onToss({ wonBy: toss.wonBy, decision: toss.decision, battingFirst: resolveBattingFirst(toss.wonBy, toss.decision) })}
        >
          Confirm Toss
        </button>
      </FlowOverlay>
    )
  }

  if (!needOpenings) return null

  // ── Openings ──────────────────────────────────────────
  const battingFirst = match.toss?.battingFirst || 'A'
  const battingKey = battingFirst === 'B' ? 'teamB' : 'teamA'
  const bowlingKey = battingFirst === 'B' ? 'teamA' : 'teamB'
  const batTeam = match[battingKey]
  const bowlTeam = match[bowlingKey]
  const batSize = (battingKey === 'teamA' ? match.teamASize : match.teamBSize) ?? match.playersPerSide
  const bowlSize = (bowlingKey === 'teamA' ? match.teamASize : match.teamBSize) ?? match.playersPerSide
  const batRoster = pad(batTeam.players, batSize)
  const bowlRoster = pad(bowlTeam.bowlingOrder?.length ? bowlTeam.bowlingOrder : bowlTeam.players, bowlSize)

  const nameFor = (roster, index, fallbackLabel) => roster[index] || `${fallbackLabel} ${index + 1}`

  if (phase === 'striker') {
    return (
      <FlowOverlay title="Opening Batsmen" subtitle={`${batTeam.name} to bat`} step={1} total={3}>
        <p className="flow-label">Select the striker</p>
        <PlayerPicker
          roster={batRoster}
          defaultLabel="Batsman"
          onSelect={({ index, name }) => {
            setOpening(o => ({ ...o, striker: index }))
            if (name) setNames(n => ({ ...n, batting: { ...n.batting, [index]: name } }))
            setPhase('nonStriker')
          }}
        />
      </FlowOverlay>
    )
  }

  if (phase === 'nonStriker') {
    return (
      <FlowOverlay title="Opening Batsmen" subtitle={`Striker: ${nameFor(batRoster, opening.striker, 'Batsman')}`} step={2} total={3} onBack={() => setPhase('striker')}>
        <p className="flow-label">Select the non-striker</p>
        <PlayerPicker
          roster={batRoster}
          defaultLabel="Batsman"
          disabledIndexes={[opening.striker]}
          onSelect={({ index, name }) => {
            setOpening(o => ({ ...o, nonStriker: index }))
            if (name) setNames(n => ({ ...n, batting: { ...n.batting, [index]: name } }))
            setPhase('bowler')
          }}
        />
      </FlowOverlay>
    )
  }

  // phase === 'bowler'
  return (
    <FlowOverlay title="Opening Bowler" subtitle={`${bowlTeam.name} to bowl`} step={3} total={3} onBack={() => setPhase('nonStriker')}>
      <p className="flow-label">Select the bowler</p>
      <PlayerPicker
        roster={bowlRoster}
        defaultLabel="Bowler"
        onSelect={({ index, name }) => {
          const bowling = name ? { ...names.bowling, [index]: name } : names.bowling
          onOpenings({
            openingSetup: { striker: opening.striker, nonStriker: opening.nonStriker, bowlerIndex: index },
            names: { batting: names.batting, bowling },
            battingFirst,
          })
        }}
      />
    </FlowOverlay>
  )
}
