import { useMemo, useState } from 'react'
import { useTournamentStore } from '../store/tournamentStore'
import { getChampion, getStandings } from '../lib/standings'
import type { TournamentRecord } from '../types'

export default function HistoryScreen() {
  const history = useTournamentStore((s) => s.history)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = history.find((r) => r.id === selectedId) ?? null
  if (selected) {
    return <HistoryDetail record={selected} onBack={() => setSelectedId(null)} />
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col gap-3 p-4 pb-24">
      <h1 className="pt-2 text-lg font-semibold">Lịch sử giải đấu</h1>

      {history.length === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-500">
          Chưa có giải nào trong lịch sử. Giải hiện tại sẽ tự lưu vào đây khi
          bạn tạo giải mới.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {history.map((record) => (
            <button
              key={record.id}
              onClick={() => setSelectedId(record.id)}
              className="rounded-lg border border-slate-700 bg-slate-800/60 p-4 text-left"
            >
              <div className="font-medium">{record.name}</div>
              <div className="mt-1 flex justify-between text-xs text-slate-500">
                <span>{new Date(record.archivedAt).toLocaleDateString('vi-VN')}</span>
                <span>
                  {record.teams.length} đội · {record.matches.length} trận
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function HistoryDetail({
  record,
  onBack,
}: {
  record: TournamentRecord
  onBack: () => void
}) {
  const standings = useMemo(
    () => getStandings(record.teams, record.matches, record.config),
    [record],
  )
  const champion = useMemo(() => getChampion(record.teams, record.matches), [record])

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col gap-3 p-4 pb-24">
      <button onClick={onBack} className="self-start text-sm text-slate-400">
        ← Quay lại
      </button>

      <h1 className="text-lg font-semibold">{record.name}</h1>
      <p className="text-xs text-slate-500">
        {new Date(record.archivedAt).toLocaleString('vi-VN')} · Mã giải: {record.code ?? '—'}
      </p>

      {champion && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center">
          <span className="text-sm font-semibold text-amber-400">
            🏆 Vô địch: {champion.name}
          </span>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-2 py-2 text-left">#</th>
              <th className="px-2 py-2 text-left">Đội</th>
              <th className="px-2 py-2 text-center">T</th>
              <th className="px-2 py-2 text-center">W</th>
              <th className="px-2 py-2 text-center">L</th>
              <th className="px-2 py-2 text-center">HS</th>
              <th className="px-2 py-2 text-center">Đ</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr key={row.teamId} className="border-t border-slate-700/60 odd:bg-slate-800/30">
                <td className="px-2 py-2 font-medium">{row.rank}</td>
                <td className="max-w-[9rem] truncate px-2 py-2">{row.name}</td>
                <td className="px-2 py-2 text-center text-slate-400">{row.played}</td>
                <td className="px-2 py-2 text-center">{row.won}</td>
                <td className="px-2 py-2 text-center text-slate-400">{row.lost}</td>
                <td className="px-2 py-2 text-center">
                  {row.frameDiff > 0 ? `+${row.frameDiff}` : row.frameDiff}
                </td>
                <td className="px-2 py-2 text-center font-semibold text-sky-400">
                  {row.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
