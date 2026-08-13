import type { QualificationAnalysis } from './qualification'
import type { Team } from '../types'

/**
 * Gọi Vercel Edge Function (api/analyze-team.ts) để Gemini diễn giải kết quả
 * `analyzeQualification` thành câu văn tự nhiên. Số liệu đã được tính xong
 * ở client (deterministic) — function chỉ soạn văn, không tự tính toán lại.
 *
 * Yêu cầu chạy qua `vercel dev` (hoặc site đã deploy trên Vercel) để route
 * `/api/analyze-team` tồn tại; `vite dev` thuần sẽ trả 404.
 */
export async function fetchQualificationNarrative(
  analysis: QualificationAnalysis,
  teams: Team[],
): Promise<string> {
  const teamName = teams.find((t) => t.id === analysis.teamId)?.name ?? '?'

  const res = await fetch('/api/analyze-team', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      teamName,
      totalTeams: analysis.totalTeams,
      currentRank: analysis.currentRank,
      status: analysis.status,
      remainingOpponentNames: analysis.remainingOwnMatches.map((m) => m.opponentName),
      minWinsForGuarantee: analysis.minWinsForGuarantee,
      mustBeatTeamNames: teams
        .filter((t) => analysis.mustBeatTeamIds.includes(t.id))
        .map((t) => t.name),
    }),
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.error ?? `Lỗi ${res.status}`)
  }
  return data.text as string
}
