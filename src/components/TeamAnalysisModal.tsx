import { useMemo, useState } from 'react'
import type { Match, Team, TournamentConfig } from '../types'
import { analyzeQualification } from '../lib/qualification'
import { fetchQualificationNarrative } from '../lib/aiAnalysis'

interface Props {
  team: Team
  teams: Team[]
  matches: Match[]
  config: TournamentConfig
  onClose: () => void
}

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  guaranteed: { text: '✅ Đã chắc chắn vào vòng trong', className: 'text-emerald-400' },
  eliminated: { text: '❌ Đã hết cơ hội vào vòng trong', className: 'text-rose-400' },
  contested: { text: '⏳ Vẫn còn cơ hội', className: 'text-amber-400' },
}

export default function TeamAnalysisModal({ team, teams, matches, config, onClose }: Props) {
  const analysis = useMemo(
    () => analyzeQualification(teams, matches, config, team.id, 2),
    [teams, matches, config, team.id],
  )

  const [aiState, setAiState] = useState<
    { status: 'idle' } | { status: 'loading' } | { status: 'done'; text: string } | { status: 'error'; error: string }
  >({ status: 'idle' })

  const handleAskAi = async () => {
    setAiState({ status: 'loading' })
    try {
      const text = await fetchQualificationNarrative(analysis, teams)
      setAiState({ status: 'done', text })
    } catch (err) {
      setAiState({ status: 'error', error: err instanceof Error ? err.message : 'Có lỗi xảy ra.' })
    }
  }

  const statusInfo = STATUS_LABEL[analysis.status]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-slate-800 p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-base font-semibold">📊 Phân tích — {team.name}</h2>
          <button onClick={onClose} className="text-slate-400" aria-label="Đóng">
            ✕
          </button>
        </div>

        <p className={`mb-3 text-sm font-medium ${statusInfo.className}`}>{statusInfo.text}</p>

        <div className="mb-4 space-y-1.5 rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-sm text-slate-300">
          <p>
            Hạng hiện tại: <span className="font-medium text-slate-100">{analysis.currentRank}/{analysis.totalTeams}</span>
          </p>
          {analysis.remainingOwnMatches.length > 0 && (
            <p>
              Còn phải gặp:{' '}
              <span className="font-medium text-slate-100">
                {analysis.remainingOwnMatches.map((m) => m.opponentName).join(', ')}
              </span>
            </p>
          )}
          {analysis.status === 'contested' && analysis.minWinsForGuarantee != null && (
            <p>
              Cần thắng thêm tối thiểu{' '}
              <span className="font-medium text-sky-400">{analysis.minWinsForGuarantee} trận</span> để chắc
              chắn vào vòng trong, bất kể kết quả đội khác.
            </p>
          )}
          {analysis.status === 'contested' && analysis.minWinsForGuarantee == null && (
            <p className="text-slate-400">
              Không có phương án nào tự thân đảm bảo 100% — cần thắng các trận còn lại và cần thêm kết quả
              thuận lợi từ các đội khác.
            </p>
          )}
          {analysis.mustBeatTeamIds.length > 0 && (
            <p>
              Bắt buộc phải thắng:{' '}
              <span className="font-medium text-rose-300">
                {teams
                  .filter((t) => analysis.mustBeatTeamIds.includes(t.id))
                  .map((t) => t.name)
                  .join(', ')}
              </span>
            </p>
          )}
        </div>

        {aiState.status === 'idle' && (
          <button
            onClick={() => void handleAskAi()}
            className="w-full rounded-lg border border-sky-600 bg-sky-600/10 py-2.5 text-sm font-medium text-sky-400 active:bg-sky-600/20"
          >
            ✨ Diễn giải bằng AI
          </button>
        )}
        {aiState.status === 'loading' && (
          <p className="text-center text-sm text-slate-400">Đang hỏi AI...</p>
        )}
        {aiState.status === 'done' && (
          <p className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-sm leading-relaxed text-slate-200">
            {aiState.text}
          </p>
        )}
        {aiState.status === 'error' && (
          <div className="space-y-2">
            <p className="text-sm text-rose-400">{aiState.error}</p>
            <button
              onClick={() => void handleAskAi()}
              className="w-full rounded-lg border border-slate-600 py-2 text-sm text-slate-300"
            >
              Thử lại
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
