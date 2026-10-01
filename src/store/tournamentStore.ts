import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Match,
  StandingRow,
  Team,
  TournamentConfig,
  TournamentRecord,
} from '../types'
import { DEFAULT_CONFIG } from '../types'
import { generateRoundRobin } from '../lib/roundRobin'
import { getStandings } from '../lib/standings'
import { validateScore } from '../lib/validation'
import { generateTournamentCode } from '../lib/code'
import { uid } from '../lib/id'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { pullTournament, pushSnapshot } from '../lib/sync'
import { pullHistory, pushHistory } from '../lib/historySync'
import type { BackupData } from '../lib/backup'

export interface SaveResult {
  ok: boolean
  error?: string
}

export interface TeamEntry {
  name: string
  members?: string[]
}

/** Id các team/match có thay đổi cục bộ chưa được đẩy lên cloud thành công. */
interface PendingSync {
  teams: string[]
  matches: string[]
}

function defaultTournamentName(date = new Date()): string {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `Giải ngày ${dd}/${mm}/${date.getFullYear()}`
}

interface TournamentState {
  code: string | null
  name: string | null
  config: TournamentConfig
  teams: Team[]
  matches: Match[]
  history: TournamentRecord[]
  /** Mã lịch sử: thiết bị nhập cùng mã sẽ dùng chung lịch sử trên cloud. */
  historyKey: string
  pendingSync: PendingSync
  lastSyncedAt: number | null

  /** Tạo giải mới từ danh sách đội. Tự lưu giải hiện tại (nếu có) vào lịch sử. */
  createTournament: (
    entries: TeamEntry[],
    config?: Partial<TournamentConfig>,
    tournamentName?: string,
  ) => void
  /** Tham gia giải đã tồn tại trên cloud bằng mã. Tự lưu giải hiện tại vào lịch sử. */
  joinTournament: (code: string) => Promise<SaveResult>
  /** Lưu tỷ số cho 1 trận (có validate theo race-to riêng của trận đó). */
  saveScore: (matchId: string, score1: number, score2: number) => SaveResult
  /** Đưa 1 trận về trạng thái chưa đấu (xoá tỷ số). */
  resetMatch: (matchId: string) => void
  /** Xoá giải hiện tại (tự lưu vào lịch sử trước khi xoá). */
  resetTournament: () => void
  /** Khôi phục từ file backup JSON. Tự lưu giải hiện tại vào lịch sử trước khi ghi đè. */
  restoreFromBackup: (data: BackupData) => void
  /** Tạo trận chung kết giữa hạng 1-2 của BXH vòng bảng, với race-to riêng. */
  createFinal: (raceTo: number) => SaveResult
  /** Đọc bảng xếp hạng (derived, chỉ tính trận vòng bảng). */
  getStandings: () => StandingRow[]

  // ── Sync nội bộ (gọi từ syncManager.ts, không gọi trực tiếp từ UI) ──────
  /** Đổi mã lịch sử rồi đồng bộ lại. */
  setHistoryKey: (key: string) => Promise<void>
  /** Hợp nhất lịch sử local với cloud (2 chiều, theo id). An toàn khi gọi lặp lại. */
  syncHistory: () => Promise<void>
  /** Đẩy các thay đổi đang chờ (pendingSync) lên cloud. An toàn khi gọi lặp lại. */
  flushPendingSync: () => Promise<void>
  /** Nhận 1 team từ realtime, merge theo last-write-wins. */
  mergeRemoteTeam: (team: Team) => void
  /** Nhận 1 match từ realtime, merge theo last-write-wins. */
  mergeRemoteMatch: (match: Match) => void
}

export const useTournamentStore = create<TournamentState>()(
  persist(
    (set, get) => {
      /** Lưu giải đang hoạt động vào lịch sử (nếu có đội) trước khi bị thay thế. */
      const archiveActiveIfAny = () => {
        const { teams, name, code, config, matches } = get()
        if (teams.length === 0) return
        const record: TournamentRecord = {
          id: uid(),
          name: name ?? defaultTournamentName(),
          code,
          config,
          teams,
          matches,
          archivedAt: Date.now(),
        }
        set((s) => ({ history: [record, ...s.history] }))
        void get().syncHistory()
      }

      return {
        code: null,
        name: null,
        config: DEFAULT_CONFIG,
        teams: [],
        matches: [],
        history: [],
        historyKey: generateTournamentCode(),
        pendingSync: { teams: [], matches: [] },
        lastSyncedAt: null,

        createTournament: (entries, config, tournamentName) => {
          archiveActiveIfAny()

          const now = Date.now()
          const teams: Team[] = entries
            .map((e) => ({ name: e.name.trim(), members: e.members }))
            .filter((e) => e.name.length > 0)
            .map((e) => ({
              id: uid(),
              name: e.name,
              members: e.members && e.members.length > 0 ? e.members : undefined,
              updatedAt: now,
            }))

          const matches = generateRoundRobin(teams.map((t) => t.id))
          const code = generateTournamentCode()

          set({
            code,
            name: tournamentName?.trim() || defaultTournamentName(),
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

          archiveActiveIfAny()
          set({
            code,
            // Tên giải không được đồng bộ qua cloud (chỉ dùng nội bộ cho lịch sử).
            name: defaultTournamentName(),
            config: DEFAULT_CONFIG,
            teams: result.teams,
            matches: result.matches,
            pendingSync: { teams: [], matches: [] },
            lastSyncedAt: Date.now(),
          })
          return { ok: true }
        },

        saveScore: (matchId, score1, score2) => {
          const { matches, config } = get()
          const match = matches.find((m) => m.id === matchId)
          if (!match) return { ok: false, error: 'Không tìm thấy trận đấu.' }

          const raceTo = match.raceTo ?? config.raceTo
          const check = validateScore(score1, score2, raceTo)
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
          archiveActiveIfAny()
          set({
            code: null,
            name: null,
            config: DEFAULT_CONFIG,
            teams: [],
            matches: [],
            pendingSync: { teams: [], matches: [] },
            lastSyncedAt: null,
          })
        },

        restoreFromBackup: (data) => {
          archiveActiveIfAny()
          set({
            code: data.code,
            name: data.name ?? defaultTournamentName(),
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

        createFinal: (raceTo) => {
          const { teams, matches, config } = get()

          if (matches.some((m) => m.stage === 'final')) {
            return { ok: false, error: 'Đã có trận chung kết.' }
          }
          const groupMatches = matches.filter((m) => m.stage !== 'final')
          if (groupMatches.length === 0 || !groupMatches.every((m) => m.status === 'completed')) {
            return { ok: false, error: 'Vòng bảng chưa đấu xong.' }
          }

          const standings = getStandings(teams, matches, config)
          if (standings.length < 2) {
            return { ok: false, error: 'Cần ít nhất 2 đội để tạo chung kết.' }
          }
          const [first, second] = standings
          const maxRound = matches.reduce((max, m) => Math.max(max, m.round), 0)

          const finalMatch: Match = {
            id: uid(),
            round: maxRound + 1,
            team1Id: first.teamId,
            team2Id: second.teamId,
            score1: null,
            score2: null,
            status: 'pending',
            stage: 'final',
            raceTo,
            updatedAt: Date.now(),
          }

          set((s) => ({
            matches: [...s.matches, finalMatch],
            pendingSync: {
              teams: s.pendingSync.teams,
              matches: [...new Set([...s.pendingSync.matches, finalMatch.id])],
            },
          }))
          void get().flushPendingSync()
          return { ok: true }
        },

        getStandings: () => {
          const { teams, matches, config } = get()
          return getStandings(teams, matches, config)
        },

        setHistoryKey: async (rawKey) => {
          const key = rawKey.trim().toUpperCase()
          if (!key) return
          set({ historyKey: key })
          await get().syncHistory()
        },

        syncHistory: async () => {
          if (!isSupabaseConfigured) return
          const key = get().historyKey
          try {
            const remote = await pullHistory(key)
            if (!remote) return
            const localIds = new Set(get().history.map((r) => r.id))
            const remoteIds = new Set(remote.map((r) => r.id))
            const incoming = remote.filter((r) => !localIds.has(r.id))
            if (incoming.length > 0) {
              set((s) => ({
                history: [...s.history, ...incoming].sort((a, b) => b.archivedAt - a.archivedAt),
              }))
            }
            await pushHistory(key, get().history.filter((r) => !remoteIds.has(r.id)))
          } catch {
            // Thử lại ở lần sync sau (online / interval trong syncManager.ts).
          }
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
      }
    },
    {
      name: 'billiard-tournament',
      // Chỉ persist dữ liệu, không persist các hàm.
      partialize: (s) => ({
        code: s.code,
        name: s.name,
        config: s.config,
        teams: s.teams,
        matches: s.matches,
        history: s.history,
        historyKey: s.historyKey,
        pendingSync: s.pendingSync,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
)
