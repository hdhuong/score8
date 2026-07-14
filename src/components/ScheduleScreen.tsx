import { useMemo, useState } from 'react'
import { useTournamentStore } from '../store/tournamentStore'
import type { Match } from '../types'
import MatchScoreModal from './MatchScoreModal'

export default function ScheduleScreen() {
  const teams = useTournamentStore((s) => s.teams)
  const matches = useTournamentStore((s) => s.matches)
  const config = useTournamentStore((s) => s.config)
  const saveScore = useTournamentStore((s) => s.saveScore)
  const resetMatch = useTournamentStore((s) => s.resetMatch)

  const [activeMatchId, setActiveMatchId] = useState<string | null>(null)

  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of teams) m.set(t.id, t.name)
    return m
  }, [teams])

  const rounds = useMemo(() => {
    const byRound = new Map<number, Match[]>()
    for (const m of matches) {
      const arr = byRound.get(m.round) ?? []
      arr.push(m)
      byRound.set(m.round, arr)
    }
    return [...byRound.entries()].sort((a, b) => a[0] - b[0])
  }, [matches])

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

  const completedCount = matches.filter((m) => m.status === 'completed').length

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col gap-4 p-4 pb-24">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-semibold">Lịch thi đấu</h1>
        <span className="text-sm text-slate-400">
          {completedCount}/{matches.length} trận
        </span>
      </div>

      {rounds.map(([round, ms]) => (
        <div key={round} className="flex flex-col gap-2">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Vòng {round}
          </div>
          {ms.map((m) => {
            const isDone = m.status === 'completed'
            return (
              <button
                key={m.id}
                onClick={() => setActiveMatchId(m.id)}
                className={`flex items-center justify-between rounded-lg border px-3 py-3 text-left ${
                  isDone
                    ? 'border-slate-700 bg-slate-800/60'
                    : 'border-slate-700 bg-slate-800'
                }`}
              >
                <span className="flex-1 truncate text-sm">
                  {nameById.get(m.team1Id)}
                </span>
                <span className="mx-3 shrink-0 text-sm font-semibold">
                  {isDone ? (
                    <span
                      className={
                        m.score1! > m.score2! ? 'text-sky-400' : 'text-slate-300'
                      }
                    >
                      {m.score1}
                    </span>
                  ) : (
                    <span className="text-slate-500">–</span>
                  )}
                  <span className="mx-1 text-slate-600">:</span>
                  {isDone ? (
                    <span
                      className={
                        m.score2! > m.score1! ? 'text-sky-400' : 'text-slate-300'
                      }
                    >
                      {m.score2}
                    </span>
                  ) : (
                    <span className="text-slate-500">–</span>
                  )}
                </span>
                <span className="flex-1 truncate text-right text-sm">
                  {nameById.get(m.team2Id)}
                </span>
              </button>
            )
          })}
        </div>
      ))}

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
    </div>
  )
}
