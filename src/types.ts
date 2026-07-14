// ── Kiểu dữ liệu lõi ────────────────────────────────────────────────────────
// Nguyên tắc: chỉ lưu `teams` (id + name) và `matches`. Mọi số liệu xếp hạng
// đều được TÍNH TỪ matches (derived), không lưu trùng lặp.

export type MatchStatus = 'pending' | 'completed'

export interface Team {
  id: string
  name: string
  /** Epoch ms của lần sửa gần nhất. Dùng để merge last-write-wins khi sync cloud. */
  updatedAt: number
}

export interface Match {
  id: string
  round: number
  team1Id: string
  team2Id: string
  score1: number | null
  score2: number | null
  status: MatchStatus
  /** Epoch ms của lần sửa gần nhất. Dùng để merge last-write-wins khi sync cloud. */
  updatedAt: number
}

export interface TournamentConfig {
  /** Điểm cho 1 trận thắng (thua = 0). Mặc định 1. */
  winPoints: number
  /** Luật chạm: thắng khi đạt số ván này. Mặc định 4. */
  raceTo: number
}

export const DEFAULT_CONFIG: TournamentConfig = {
  winPoints: 1,
  raceTo: 4,
}

// ── Hàng trong bảng xếp hạng (kết quả derived) ─────────────────────────────
export interface StandingRow {
  teamId: string
  name: string
  played: number
  won: number
  lost: number
  framesWon: number
  framesLost: number
  frameDiff: number
  points: number
  /** Thứ hạng 1-based; các đội đồng hạng nhận cùng số. */
  rank: number
}
