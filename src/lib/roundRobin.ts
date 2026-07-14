import type { Match } from '../types'
import { uid } from './id'

/**
 * Sinh lịch thi đấu vòng tròn một lượt (single round-robin) bằng "circle method".
 *
 * - Mỗi cặp đội gặp nhau đúng 1 lần.
 * - Số vòng = n-1 (n chẵn) hoặc n (n lẻ, mỗi vòng có 1 đội nghỉ - BYE).
 * - 5 đội  -> 10 trận / 5 vòng.
 * - 6 đội  -> 15 trận / 5 vòng.
 *
 * Thuật toán: cố định phần tử đầu, xoay các phần tử còn lại qua từng vòng.
 * Deterministic: cùng input -> cùng lịch (trừ id ngẫu nhiên).
 */
export function generateRoundRobin(teamIds: string[]): Match[] {
  const ids = [...teamIds]

  // Số lẻ: thêm 1 slot BYE ảo để ghép cặp; cặp nào dính BYE sẽ bị bỏ.
  const BYE = '__bye__'
  if (ids.length % 2 !== 0) ids.push(BYE)

  const n = ids.length
  const rounds = n - 1
  const half = n / 2

  // arr[0] cố định, các phần tử còn lại xoay vòng.
  const arr = [...ids]
  const matches: Match[] = []

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = arr[i]
      const b = arr[n - 1 - i]
      if (a !== BYE && b !== BYE) {
        matches.push({
          id: uid(),
          round: r + 1,
          team1Id: a,
          team2Id: b,
          score1: null,
          score2: null,
          status: 'pending',
          updatedAt: Date.now(),
        })
      }
    }

    // Xoay: giữ arr[0], dịch phần còn lại theo chiều kim đồng hồ.
    const fixed = arr[0]
    const rest = arr.slice(1)
    rest.unshift(rest.pop()!)
    arr.splice(0, arr.length, fixed, ...rest)
  }

  return matches
}
