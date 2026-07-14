import { useMemo } from 'react'
import { useTournamentStore } from '../store/tournamentStore'
import { getStandings } from '../lib/standings'

export default function LeaderboardScreen() {
  const teams = useTournamentStore((s) => s.teams)
  const matches = useTournamentStore((s) => s.matches)
  const config = useTournamentStore((s) => s.config)

  const standings = useMemo(
    () => getStandings(teams, matches, config),
    [teams, matches, config],
  )

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col gap-3 p-4 pb-24">
      <h1 className="pt-2 text-lg font-semibold">Bảng xếp hạng</h1>

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
              <tr
                key={row.teamId}
                className="border-t border-slate-700/60 odd:bg-slate-800/30"
              >
                <td className="px-2 py-2 font-medium">
                  {row.rank <= 3 ? (
                    <span
                      className={
                        row.rank === 1
                          ? 'text-amber-400'
                          : row.rank === 2
                            ? 'text-slate-300'
                            : 'text-orange-400'
                      }
                    >
                      {row.rank}
                    </span>
                  ) : (
                    row.rank
                  )}
                </td>
                <td className="max-w-[9rem] truncate px-2 py-2">{row.name}</td>
                <td className="px-2 py-2 text-center text-slate-400">
                  {row.played}
                </td>
                <td className="px-2 py-2 text-center">{row.won}</td>
                <td className="px-2 py-2 text-center text-slate-400">
                  {row.lost}
                </td>
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

      <p className="px-1 text-xs text-slate-500">
        T: trận đã đấu · W/L: thắng/thua · HS: hiệu số ván · Đ: điểm
      </p>
    </div>
  )
}
