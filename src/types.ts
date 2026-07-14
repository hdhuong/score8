// ── Kiểu dữ liệu lõi ────────────────────────────────────────────────────────
// Nguyên tắc: chỉ lưu `teams` (id + name) và `matches`. Mọi số liệu xếp hạng
// đều được TÍNH TỪ matches (derived), không lưu trùng lặp.

export type MatchStatus = 'pending' | 'completed'
export type MatchStage = 'group' | 'final'

export interface Team {
  id: string
  name: string
  /** Tên thành viên trong đội (thuần thông tin, không ảnh hưởng logic đấu). */
  members?: string[]
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
  /** 'group' = vòng tròn tính BXH; 'final' = chung kết, không tính vào BXH. */
  stage: MatchStage
  /** Race-to riêng cho trận này (chỉ set ở trận 'final'); trận 'group' dùng config.raceTo. */
  raceTo?: number
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

// ── Lịch sử giải (snapshot read-only, không sửa/sync lại) ─────────────────
export interface TournamentRecord {
  id: string
  name: string
  code: string | null
  config: TournamentConfig
  teams: Team[]
  matches: Match[]
  archivedAt: number
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
