import { useMemo, useState } from 'react'
import { useTournamentStore } from '../store/tournamentStore'
import type { Match } from '../types'
import { getChampion } from '../lib/standings'
import MatchScoreModal from './MatchScoreModal'
import CreateFinalModal from './CreateFinalModal'

function MatchRow({
  match,
  nameById,
  onClick,
}: {
  match: Match
  nameById: Map<string, string>
  onClick: () => void
}) {
  const isDone = match.status === 'completed'
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between rounded-lg border px-3 py-3 text-left ${
        isDone ? 'border-slate-700 bg-slate-800/60' : 'border-slate-700 bg-slate-800'
      }`}
    >
      <span className="flex-1 truncate text-sm">{nameById.get(match.team1Id)}</span>
      <span className="mx-3 shrink-0 text-sm font-semibold">
        {isDone ? (
          <span className={match.score1! > match.score2! ? 'text-sky-400' : 'text-slate-300'}>
            {match.score1}
          </span>
        ) : (
          <span className="text-slate-500">–</span>
        )}
        <span className="mx-1 text-slate-600">:</span>
        {isDone ? (
          <span className={match.score2! > match.score1! ? 'text-sky-400' : 'text-slate-300'}>
            {match.score2}
          </span>
        ) : (
          <span className="text-slate-500">–</span>
        )}
      </span>
      <span className="flex-1 truncate text-right text-sm">{nameById.get(match.team2Id)}</span>
    </button>
  )
}

export default function ScheduleScreen() {
  const teams = useTournamentStore((s) => s.teams)
  const matches = useTournamentStore((s) => s.matches)
  const config = useTournamentStore((s) => s.config)
  const saveScore = useTournamentStore((s) => s.saveScore)
  const resetMatch = useTournamentStore((s) => s.resetMatch)
  const createFinal = useTournamentStore((s) => s.createFinal)

  const [activeMatchId, setActiveMatchId] = useState<string | null>(null)
  const [showCreateFinal, setShowCreateFinal] = useState(false)
  const [finalError, setFinalError] = useState<string | null>(null)

  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of teams) m.set(t.id, t.name)
    return m
  }, [teams])

  const groupMatches = useMemo(() => matches.filter((m) => m.stage !== 'final'), [matches])
  const finalMatch = useMemo(() => matches.find((m) => m.stage === 'final') ?? null, [matches])

  const rounds = useMemo(() => {
    const byRound = new Map<number, Match[]>()
    for (const m of groupMatches) {
      const arr = byRound.get(m.round) ?? []
      arr.push(m)
      byRound.set(m.round, arr)
    }
    return [...byRound.entries()].sort((a, b) => a[0] - b[0])
  }, [groupMatches])

  const allGroupDone = groupMatches.length > 0 && groupMatches.every((m) => m.status === 'completed')
  const champion = useMemo(() => getChampion(teams, matches), [teams, matches])

  const activeMatch = matches.find((m) => m.id === activeMatchId) ?? null

  const handleSave = (score1: number, score2: number) => {
    if (!activeMatch) return
    const res = saveScore(activeMatch.id, score1, score2)
    if (res.ok) setActiveMatchId(null)
  }

  const handleReset = () => {
    if (!activeMatch) return
    resetMatch(activeMatch.id)
    setActiveMatchId(null)
  }

  const handleCreateFinal = (raceTo: number) => {
    const res = createFinal(raceTo)
    if (res.ok) {
      setShowCreateFinal(false)
      setFinalError(null)
    } else {
      setFinalError(res.error ?? 'Không thể tạo trận chung kết.')
    }
  }

  const completedCount = groupMatches.filter((m) => m.status === 'completed').length

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col gap-4 p-4 pb-24">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-semibold">Lịch thi đấu</h1>
        <span className="text-sm text-slate-400">
          {completedCount}/{groupMatches.length} trận
        </span>
      </div>

      {champion && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center">
          <span className="text-sm font-semibold text-amber-400">
            🏆 Vô địch: {champion.name}
          </span>
        </div>
      )}

      {rounds.map(([round, ms]) => (
        <div key={round} className="flex flex-col gap-2">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Vòng {round}
          </div>
          {ms.map((m) => (
            <MatchRow key={m.id} match={m} nameById={nameById} onClick={() => setActiveMatchId(m.id)} />
          ))}
        </div>
      ))}

      {finalMatch && (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-medium uppercase tracking-wide text-amber-400">
            🏆 Chung kết
          </div>
          <MatchRow match={finalMatch} nameById={nameById} onClick={() => setActiveMatchId(finalMatch.id)} />
        </div>
      )}

      {allGroupDone && !finalMatch && (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-amber-500/40 p-4 text-center">
          <p className="text-sm text-slate-300">Vòng bảng đã đấu xong.</p>
          <button
            onClick={() => setShowCreateFinal(true)}
            className="rounded-lg bg-amber-500 py-2.5 text-sm font-medium text-slate-900"
          >
            🏆 Tạo trận Chung kết
          </button>
          {finalError && <p className="text-xs text-red-400">{finalError}</p>}
        </div>
      )}

      {activeMatch && (
        <MatchScoreModal
          match={activeMatch}
          teamName1={nameById.get(activeMatch.team1Id) ?? ''}
          teamName2={nameById.get(activeMatch.team2Id) ?? ''}
          config={config}
          onSave={handleSave}
          onReset={handleReset}
          onClose={() => setActiveMatchId(null)}
        />
      )}

      {showCreateFinal && (
        <CreateFinalModal onCreate={handleCreateFinal} onClose={() => setShowCreateFinal(false)} />
      )}
    </div>
  )
}
