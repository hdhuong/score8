import { useTournamentStore } from '../store/tournamentStore'
import { isSupabaseConfigured } from './supabaseClient'
import { subscribeTournament } from './sync'

let unsubscribeRealtime: (() => void) | null = null

function startRealtimeFor(code: string) {
  unsubscribeRealtime?.()
  unsubscribeRealtime = subscribeTournament(
    code,
    (team) => useTournamentStore.getState().mergeRemoteTeam(team),
    (match) => useTournamentStore.getState().mergeRemoteMatch(match),
  )
}

function stopRealtime() {
  unsubscribeRealtime?.()
  unsubscribeRealtime = null
}

/**
 * Khởi động lớp đồng bộ cloud: mở realtime subscription theo `code` hiện tại
 * (kể cả giải đã tồn tại từ trước khi load lại trang), tự mở lại khi `code`
 * đổi, và cố gắng đẩy lại các thay đổi đang chờ (pendingSync) khi có mạng.
 * No-op hoàn toàn nếu chưa cấu hình Supabase — an toàn khi gọi luôn từ main.tsx.
 */
export function initSyncManager() {
  if (!isSupabaseConfigured) return

  const initialCode = useTournamentStore.getState().code
  if (initialCode) startRealtimeFor(initialCode)

  useTournamentStore.subscribe((state, prevState) => {
    if (state.code !== prevState.code) {
      if (state.code) startRealtimeFor(state.code)
      else stopRealtime()
    }
  })

  void useTournamentStore.getState().flushPendingSync()
  void useTournamentStore.getState().syncHistory()
  window.addEventListener('online', () => {
    void useTournamentStore.getState().flushPendingSync()
    void useTournamentStore.getState().syncHistory()
  })
  // Dự phòng: 'online' event không phải lúc nào cũng bắn (vd Safari trên vài mạng).
  setInterval(() => {
    if (!navigator.onLine) return
    void useTournamentStore.getState().flushPendingSync()
    void useTournamentStore.getState().syncHistory()
  }, 20000)
}
