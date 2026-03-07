import { useState } from 'react'
import MatchList from './components/MatchList'
import NewMatch from './components/NewMatch'
import Scoring from './components/Scoring'
import Scorecard from './components/Scorecard'

export default function App() {
  const [screen, setScreen] = useState('home')
  const [matchId, setMatchId] = useState(null)

  function goHome() {
    setScreen('home')
    setMatchId(null)
  }

  function startMatch(id) {
    setMatchId(id)
    setScreen('scoring')
  }

  function viewScorecard(id) {
    setMatchId(id)
    setScreen('scorecard')
  }

  function resumeMatch(id) {
    setMatchId(id)
    setScreen('scoring')
  }

  if (screen === 'new') {
    return <NewMatch onBack={goHome} onStart={startMatch} />
  }

  if (screen === 'scoring') {
    return <Scoring matchId={matchId} onBack={goHome} onViewScorecard={() => viewScorecard(matchId)} />
  }

  if (screen === 'scorecard') {
    return <Scorecard matchId={matchId} onBack={goHome} onResume={() => resumeMatch(matchId)} />
  }

  return (
    <div className="container">
      <h1 className="app-title">Box Cricket</h1>
      <button className="btn btn-primary btn-large" onClick={() => setScreen('new')}>
        New Match
      </button>
      <MatchList onResume={resumeMatch} onView={viewScorecard} />
    </div>
  )
}
