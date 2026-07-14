import { useState } from 'react'
import { useTournamentStore } from '../store/tournamentStore'
import { isSupabaseConfigured } from '../lib/supabaseClient'

const MIN_TEAMS = 3
const MAX_TEAMS = 12
const DEFAULT_ROWS = 6

type Mode = 'create' | 'join'

export default function SetupScreen() {
  const [mode, setMode] = useState<Mode>('create')

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col gap-5 p-5 pb-24">
      <div className="pt-4 text-center">
        <div className="text-3xl">🎱</div>
        <h1 className="mt-1 text-xl font-semibold">
          {mode === 'create' ? 'Tạo giải đấu mới' : 'Tham gia giải đấu'}
        </h1>
      </div>

      {isSupabaseConfigured && (
        <div className="flex rounded-lg border border-slate-700 p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`flex-1 rounded-md py-2 ${
              mode === 'create' ? 'bg-sky-600 text-white' : 'text-slate-400'
            }`}
          >
            Tạo mới
          </button>
          <button
            type="button"
            onClick={() => setMode('join')}
            className={`flex-1 rounded-md py-2 ${
              mode === 'join' ? 'bg-sky-600 text-white' : 'text-slate-400'
            }`}
          >
            Tham gia bằng mã
          </button>
        </div>
      )}

      {mode === 'create' ? <CreatePanel /> : <JoinPanel />}
    </div>
  )
}

function CreatePanel() {
  const createTournament = useTournamentStore((s) => s.createTournament)
  const [names, setNames] = useState<string[]>(Array(DEFAULT_ROWS).fill(''))
  const [error, setError] = useState<string | null>(null)

  const updateName = (i: number, value: string) => {
    setNames((prev) => prev.map((n, idx) => (idx === i ? value : n)))
  }

  const addRow = () => {
    if (names.length >= MAX_TEAMS) return
    setNames((prev) => [...prev, ''])
  }

  const removeRow = (i: number) => {
    if (names.length <= MIN_TEAMS) return
    setNames((prev) => prev.filter((_, idx) => idx !== i))
  }

  const handleSubmit = () => {
    const trimmed = names.map((n) => n.trim()).filter((n) => n.length > 0)

    if (trimmed.length < MIN_TEAMS) {
      setError(`Cần ít nhất ${MIN_TEAMS} đội.`)
      return
    }
    const lower = trimmed.map((n) => n.toLowerCase())
    if (new Set(lower).size !== lower.length) {
      setError('Tên đội bị trùng, vui lòng kiểm tra lại.')
      return
    }

    setError(null)
    createTournament(trimmed)
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-center text-sm text-slate-400">
        Nhập danh sách đội (khuyến nghị 5-6 đội). Lịch vòng tròn sẽ tự sinh.
      </p>

      <div className="flex flex-col gap-2">
        {names.map((name, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-right text-sm text-slate-500">
              {i + 1}
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => updateName(i, e.target.value)}
              placeholder={`Tên đội ${i + 1}`}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-500"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              disabled={names.length <= MIN_TEAMS}
              className="shrink-0 rounded-lg border border-slate-700 px-2.5 py-2 text-sm text-slate-400 disabled:opacity-30"
              aria-label="Xoá đội"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        disabled={names.length >= MAX_TEAMS}
        className="rounded-lg border border-dashed border-slate-700 py-2 text-sm text-slate-400 disabled:opacity-30"
      >
        + Thêm đội
      </button>

      {error && (
        <div className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        className="mt-2 rounded-lg bg-sky-600 py-3 text-base font-medium text-white active:bg-sky-700"
      >
        Tạo lịch thi đấu
      </button>
    </div>
  )
}

function JoinPanel() {
  const joinTournament = useTournamentStore((s) => s.joinTournament)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleJoin = async () => {
    if (code.trim().length !== 6) {
      setError('Mã giải gồm 6 ký tự.')
      return
    }
    setError(null)
    setLoading(true)
    const res = await joinTournament(code)
    setLoading(false)
    if (!res.ok) setError(res.error ?? 'Không thể tham gia giải.')
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-sm text-slate-400">
        Nhập mã giải do người tạo chia sẻ để xem và cùng ghi điểm real-time.
      </p>

      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="VD: A3K9Q2"
        maxLength={6}
        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 text-center text-lg font-bold tracking-widest outline-none focus:border-sky-500"
      />

      {error && (
        <div className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleJoin}
        disabled={loading}
        className="rounded-lg bg-sky-600 py-3 text-base font-medium text-white active:bg-sky-700 disabled:opacity-50"
      >
        {loading ? 'Đang tìm giải...' : 'Tham gia'}
      </button>
    </div>
  )
}
