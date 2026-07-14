import type { Match, TournamentConfig } from '../types'
import { validScorePairs } from '../lib/validation'

interface Props {
  match: Match
  teamName1: string
  teamName2: string
  config: TournamentConfig
  onSave: (score1: number, score2: number) => void
  onReset: () => void
  onClose: () => void
}

export default function MatchScoreModal({
  match,
  teamName1,
  teamName2,
  config,
  onSave,
  onReset,
  onClose,
}: Props) {
  const pairs = validScorePairs(config)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-slate-800 p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Ghi tỷ số</h2>
          <button
            onClick={onClose}
            className="text-slate-400"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {match.status === 'completed' && (
          <div className="mb-4 rounded-lg bg-slate-700/50 px-3 py-2 text-center text-sm text-slate-300">
            Tỷ số hiện tại: <b>{match.score1}</b> - <b>{match.score2}</b>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-2 truncate text-center text-sm font-medium text-slate-200">
              {teamName1}
            </div>
            <div className="flex flex-col gap-2">
              {pairs.map(([w, l]) => (
                <button
                  key={`t1-${w}-${l}`}
                  onClick={() => onSave(w, l)}
                  className="rounded-lg border border-slate-600 py-2.5 text-sm font-medium active:bg-sky-600 active:border-sky-600"
                >
                  {w} - {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 truncate text-center text-sm font-medium text-slate-200">
              {teamName2}
            </div>
            <div className="flex flex-col gap-2">
              {pairs.map(([w, l]) => (
                <button
                  key={`t2-${w}-${l}`}
                  onClick={() => onSave(l, w)}
                  className="rounded-lg border border-slate-600 py-2.5 text-sm font-medium active:bg-sky-600 active:border-sky-600"
                >
                  {w} - {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {match.status === 'completed' && (
          <button
            onClick={onReset}
            className="mt-4 w-full rounded-lg border border-red-900 py-2.5 text-sm text-red-400"
          >
            Đặt lại trận đấu (chưa đấu)
          </button>
        )}
      </div>
    </div>
  )
}
