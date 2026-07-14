import type { TournamentConfig } from '../types'

export interface ScoreValidation {
  valid: boolean
  error?: string
}

/**
 * Kiểm tra tỷ số hợp lệ theo luật "chạm N" (raceTo).
 * - Đúng 1 đội đạt N, đội còn lại từ 0..N-1.
 * - Không hoà.
 * Ví dụ raceTo=4: hợp lệ 4-0, 4-1, 4-2, 4-3 và đảo lại.
 */
export function validateScore(
  score1: number,
  score2: number,
  config: TournamentConfig,
): ScoreValidation {
  const N = config.raceTo

  if (!Number.isInteger(score1) || !Number.isInteger(score2)) {
    return { valid: false, error: 'Tỷ số phải là số nguyên.' }
  }
  if (score1 < 0 || score2 < 0) {
    return { valid: false, error: 'Tỷ số không được âm.' }
  }
  if (score1 === score2) {
    return { valid: false, error: 'Không thể hoà.' }
  }

  const max = Math.max(score1, score2)
  const min = Math.min(score1, score2)

  if (max !== N) {
    return { valid: false, error: `Đội thắng phải đạt đúng ${N} ván.` }
  }
  if (min < 0 || min > N - 1) {
    return { valid: false, error: `Đội thua phải đạt 0..${N - 1} ván.` }
  }

  return { valid: true }
}

/**
 * Danh sách các tỷ số hợp lệ (dùng cho score picker ở UI).
 * Trả về mảng [thắng, thua] ví dụ [[4,0],[4,1],[4,2],[4,3]].
 */
export function validScorePairs(config: TournamentConfig): Array<[number, number]> {
  const N = config.raceTo
  const pairs: Array<[number, number]> = []
  for (let loser = 0; loser < N; loser++) {
    pairs.push([N, loser])
  }
  return pairs
}
