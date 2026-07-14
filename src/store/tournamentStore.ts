import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Match, StandingRow, Team, TournamentConfig } from '../types'
import { DEFAULT_CONFIG } from '../types'
import { generateRoundRobin } from '../lib/roundRobin'
import { getStandings } from '../lib/standings'
import { validateScore } from '../lib/validation'
import { generateTournamentCode } from '../lib/code'
import { uid } from '../lib/id'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { pullTournament, pushSnapshot } from '../lib/sync'
import type { BackupData } from '../lib/backup'

export interface SaveResult {
  ok: boolean
  error?: string
}

/** Id các team/match có thay đổi cục bộ chưa được đẩy lên cloud thành công. */
interface PendingSync {
  teams: string[]
  matches: string[]
}

interface TournamentState {
  code: string | null
  config: TournamentConfig
  teams: Team[]
  matches: Match[]
  pendingSync: PendingSync
  lastSyncedAt: number | null

  /** Tạo giải mới từ danh sách tên đội. Ghi đè giải hiện tại. */
  createTournament: (names: string[], config?: Partial<TournamentConfig>) => void
  /** Tham gia giải đã tồn tại trên cloud bằng mã. Ghi đè giải hiện tại. */
  joinTournament: (code: string) => Promise<SaveResult>
  /** Lưu tỷ số cho 1 trận (có validate). */
  saveScore: (matchId: string, score1: number, score2: number) => SaveResult
  /** Đưa 1 trận về trạng thái chưa đấu (xoá tỷ số). */
  resetMatch: (matchId: string) => void
  /** Xoá toàn bộ giải. */
  resetTournament: () => void
  /** Khôi phục từ file backup JSON. Ghi đè giải hiện tại và đẩy lại lên cloud (nếu có). */
  restoreFromBackup: (data: BackupData) => void
  /** Đọc bảng xếp hạng (derived). */
  getStandings: () => StandingRow[]

  // ── Sync nội bộ (gọi từ syncManager.ts, không gọi trực tiếp từ UI) ──────
  /** Đẩy các thay đổi đang chờ (pendingSync) lên cloud. An toàn khi gọi lặp lại. */
  flushPendingSync: () => Promise<void>
  /** Nhận 1 team từ realtime, merge theo last-write-wins. */
  mergeRemoteTeam: (team: Team) => void
  /** Nhận 1 match từ realtime, merge theo last-write-wins. */
  mergeRemoteMatch: (match: Match) => void
}

export const useTournamentStore = create<TournamentState>()(
  persist(
    (set, get) => ({
      code: null,
      config: DEFAULT_CONFIG,
      teams: [],
      matches: [],
      pendingSync: { teams: [], matches: [] },
      lastSyncedAt: null,

      createTournament: (names, config) => {
        const now = Date.now()
        const teams: Team[] = names
          .map((n) => n.trim())
          .filter((n) => n.length > 0)
          .map((name) => ({ id: uid(), name, updatedAt: now }))

        const matches = generateRoundRobin(teams.map((t) => t.id))
        const code = generateTournamentCode()

        set({
          code,
          config: { ...DEFAULT_CONFIG, ...config },
          teams,
          matches,
          pendingSync: {
            teams: teams.map((t) => t.id),
            matches: matches.map((m) => m.id),
          },
        })

        void get().flushPendingSync()
      },

      joinTournament: async (rawCode) => {
        const code = rawCode.trim().toUpperCase()
        if (!isSupabaseConfigured) {
          return { ok: false, error: 'Chưa cấu hình đồng bộ cloud.' }
        }
        const result = await pullTournament(code)
        if (!result) {
          return { ok: false, error: 'Không tìm thấy giải với mã này.' }
        }

        set({
          code,
          config: DEFAULT_CONFIG,
          teams: result.teams,
          matches: result.matches,
          pendingSync: { teams: [], matches: [] },
          lastSyncedAt: Date.now(),
        })
        return { ok: true }
      },

      saveScore: (matchId, score1, score2) => {
        const { config, matches } = get()
        const check = validateScore(score1, score2, config)
        if (!check.valid) return { ok: false, error: check.error }

        set((s) => ({
          matches: matches.map((m) =>
            m.id === matchId
              ? { ...m, score1, score2, status: 'completed' as const, updatedAt: Date.now() }
              : m,
          ),
          pendingSync: {
            teams: s.pendingSync.teams,
            matches: [...new Set([...s.pendingSync.matches, matchId])],
          },
        }))
        void get().flushPendingSync()
        return { ok: true }
      },

      resetMatch: (matchId) => {
        set((s) => ({
          matches: s.matches.map((m) =>
            m.id === matchId
              ? { ...m, score1: null, score2: null, status: 'pending' as const, updatedAt: Date.now() }
              : m,
          ),
          pendingSync: {
            teams: s.pendingSync.teams,
            matches: [...new Set([...s.pendingSync.matches, matchId])],
          },
        }))
        void get().flushPendingSync()
      },

      resetTournament: () => {
        set({
          code: null,
          config: DEFAULT_CONFIG,
          teams: [],
          matches: [],
          pendingSync: { teams: [], matches: [] },
          lastSyncedAt: null,
        })
      },

      restoreFromBackup: (data) => {
        set({
          code: data.code,
          config: data.config,
          teams: data.teams,
          matches: data.matches,
          pendingSync: {
            teams: data.teams.map((t) => t.id),
            matches: data.matches.map((m) => m.id),
          },
          lastSyncedAt: null,
        })
        void get().flushPendingSync()
      },

      getStandings: () => {
        const { teams, matches, config } = get()
        return getStandings(teams, matches, config)
      },

      flushPendingSync: async () => {
        const { code, teams, matches, pendingSync } = get()
        if (!code || !isSupabaseConfigured) return
        if (pendingSync.teams.length === 0 && pendingSync.matches.length === 0) return

        const teamIds = [...pendingSync.teams]
        const matchIds = [...pendingSync.matches]
        const teamsToPush = teams.filter((t) => teamIds.includes(t.id))
        const matchesToPush = matches.filter((m) => matchIds.includes(m.id))

        try {
          await pushSnapshot(code, teamsToPush, matchesToPush)

          set((s) => ({
            pendingSync: {
              teams: s.pendingSync.teams.filter((id) => !teamIds.includes(id)),
              matches: s.pendingSync.matches.filter((id) => !matchIds.includes(id)),
            },
            lastSyncedAt: Date.now(),
          }))
        } catch {
          // Giữ nguyên trong pendingSync — sẽ thử lại khi có mạng (xem syncManager.ts).
        }
      },

      mergeRemoteTeam: (remote) => {
        const { teams, pendingSync } = get()
        // Đang có thay đổi cục bộ chưa đẩy lên -> local thắng, bỏ qua bản remote.
        if (pendingSync.teams.includes(remote.id)) return

        const local = teams.find((t) => t.id === remote.id)
        if (local && local.updatedAt >= remote.updatedAt) return

        set({
          teams: local
            ? teams.map((t) => (t.id === remote.id ? remote : t))
            : [...teams, remote],
          lastSyncedAt: Date.now(),
        })
      },

      mergeRemoteMatch: (remote) => {
        const { matches, pendingSync } = get()
        if (pendingSync.matches.includes(remote.id)) return

        const local = matches.find((m) => m.id === remote.id)
        if (local && local.updatedAt >= remote.updatedAt) return

        set({
          matches: local
            ? matches.map((m) => (m.id === remote.id ? remote : m))
            : [...matches, remote],
          lastSyncedAt: Date.now(),
        })
      },
    }),
    {
      name: 'billiard-tournament',
      // Chỉ persist dữ liệu, không persist các hàm.
      partialize: (s) => ({
        code: s.code,
        config: s.config,
        teams: s.teams,
        matches: s.matches,
        pendingSync: s.pendingSync,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
)
