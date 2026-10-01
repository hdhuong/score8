import { useEffect, useRef, useState } from 'react'
import { useTournamentStore } from '../store/tournamentStore'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { downloadBackup, parseBackup } from '../lib/backup'

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

function formatTime(ts: number | null) {
  if (!ts) return 'chưa đồng bộ'
  return new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

export default function SettingsScreen() {
  const code = useTournamentStore((s) => s.code)
  const name = useTournamentStore((s) => s.name)
  const teams = useTournamentStore((s) => s.teams)
  const matches = useTournamentStore((s) => s.matches)
  const pendingSync = useTournamentStore((s) => s.pendingSync)
  const lastSyncedAt = useTournamentStore((s) => s.lastSyncedAt)
  const flushPendingSync = useTournamentStore((s) => s.flushPendingSync)
  const resetTournament = useTournamentStore((s) => s.resetTournament)
  const restoreFromBackup = useTournamentStore((s) => s.restoreFromBackup)
  const config = useTournamentStore((s) => s.config)
  const historyKey = useTournamentStore((s) => s.historyKey)
  const setHistoryKey = useTournamentStore((s) => s.setHistoryKey)
  const [keyInput, setKeyInput] = useState('')

  const online = useOnlineStatus()
  const completedCount = matches.filter((m) => m.status === 'completed').length
  const pendingCount = pendingSync.teams.length + pendingSync.matches.length

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const handleNewTournament = () => {
    const ok = window.confirm(
      'Tạo giải mới sẽ xoá toàn bộ đội và kết quả hiện tại. Tiếp tục?',
    )
    if (ok) resetTournament()
  }

  const handleExport = () => {
    downloadBackup({ code, name, config, teams, matches })
  }

  const handleImportClick = () => {
    setImportError(null)
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // cho phép chọn lại cùng 1 file lần sau
    if (!file) return

    const text = await file.text()
    const data = parseBackup(text)
    if (!data) {
      setImportError('File backup không hợp lệ.')
      return
    }

    const ok = window.confirm(
      `Nhập backup (${data.teams.length} đội, xuất lúc ${new Date(data.exportedAt).toLocaleString('vi-VN')}) sẽ ghi đè dữ liệu hiện tại. Tiếp tục?`,
    )
    if (!ok) return

    setImportError(null)
    restoreFromBackup(data)
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col gap-5 p-4 pb-24">
      <h1 className="pt-2 text-lg font-semibold">Cài đặt</h1>

      <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
        {name && <div className="mb-2 text-sm font-medium text-slate-200">{name}</div>}
        <div className="text-xs uppercase tracking-wide text-slate-500">
          Mã giải
        </div>
        <div className="mt-1 text-2xl font-bold tracking-widest text-sky-400">
          {code ?? '—'}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Chia sẻ mã này để người khác "Tham gia bằng mã" và cùng xem/ghi
          điểm real-time. Lưu ý: ai có mã đều sửa được dữ liệu (không có tài
          khoản/mật khẩu).
        </p>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Đồng bộ cloud
          </div>
          <span
            className={`h-2 w-2 rounded-full ${
              !isSupabaseConfigured
                ? 'bg-slate-600'
                : online
                  ? 'bg-emerald-500'
                  : 'bg-amber-500'
            }`}
          />
        </div>

        {!isSupabaseConfigured ? (
          <p className="mt-2 text-sm text-slate-400">
            Chưa cấu hình — app đang chạy hoàn toàn offline (localStorage).
          </p>
        ) : (
          <>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-slate-400">Trạng thái mạng</span>
              <span>{online ? 'Online' : 'Offline'}</span>
            </div>
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-slate-400">Đồng bộ lần cuối</span>
              <span>{formatTime(lastSyncedAt)}</span>
            </div>
            {pendingCount > 0 && (
              <div className="mt-1 flex justify-between text-sm">
                <span className="text-slate-400">Đang chờ đồng bộ</span>
                <span className="text-amber-400">{pendingCount} mục</span>
              </div>
            )}
            <button
              onClick={() => void flushPendingSync()}
              className="mt-3 w-full rounded-lg border border-slate-600 py-2 text-sm text-slate-300"
            >
              Đồng bộ ngay
            </button>
          </>
        )}
      </div>

      {isSupabaseConfigured && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Mã lịch sử</div>
          <div className="mt-1 text-2xl font-bold tracking-widest text-sky-400">{historyKey}</div>
          <p className="mt-1 text-xs text-slate-500">
            Lịch sử giải được lưu trên cloud theo mã này. Nhập cùng mã trên máy khác để xem chung
            lịch sử (ai có mã đều xem được).
          </p>
          <div className="mt-3 flex gap-2">
            <input
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Nhập mã lịch sử khác"
              maxLength={6}
              className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm uppercase"
            />
            <button
              disabled={keyInput.trim().length === 0}
              onClick={() => {
                void setHistoryKey(keyInput)
                setKeyInput('')
              }}
              className="rounded-lg border border-slate-600 px-4 text-sm text-slate-300 disabled:opacity-40"
            >
              Dùng
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
        <div className="text-xs uppercase tracking-wide text-slate-500">
          Thống kê giải
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-slate-400">Số đội</span>
          <span>{teams.length}</span>
        </div>
        <div className="mt-1 flex justify-between text-sm">
          <span className="text-slate-400">Trận đã đấu</span>
          <span>
            {completedCount}/{matches.length}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
        <div className="text-xs uppercase tracking-wide text-slate-500">
          Danh sách đội
        </div>
        <div className="mt-2 flex flex-col gap-2">
          {teams.map((t) => (
            <div key={t.id} className="text-sm">
              <span className="font-medium">{t.name}</span>
              <span className="text-slate-500">
                {' — '}
                {t.members && t.members.length > 0 ? t.members.join(', ') : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
        <div className="text-xs uppercase tracking-wide text-slate-500">
          Sao lưu dữ liệu
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Xuất/nhập file JSON để sao lưu thủ công hoặc chuyển dữ liệu sang máy
          khác, độc lập với đồng bộ cloud.
        </p>

        <div className="mt-3 flex gap-2">
          <button
            onClick={handleExport}
            className="flex-1 rounded-lg border border-slate-600 py-2 text-sm text-slate-300"
          >
            Xuất file backup
          </button>
          <button
            onClick={handleImportClick}
            className="flex-1 rounded-lg border border-slate-600 py-2 text-sm text-slate-300"
          >
            Nhập từ file
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => void handleFileSelected(e)}
        />

        {importError && (
          <div className="mt-3 rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
            {importError}
          </div>
        )}
      </div>

      <button
        onClick={handleNewTournament}
        className="mt-2 rounded-lg border border-red-900 py-3 text-sm font-medium text-red-400"
      >
        Tạo giải mới (xoá giải hiện tại)
      </button>
    </div>
  )
}
