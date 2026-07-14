import type { Match, Team, TournamentConfig } from '../types'

export interface BackupData {
  version: 1
  exportedAt: number
  code: string | null
  config: TournamentConfig
  teams: Team[]
  matches: Match[]
}

/** Tải file JSON backup xuống máy người dùng. */
export function downloadBackup(data: Omit<BackupData, 'version' | 'exportedAt'>) {
  const backup: BackupData = { version: 1, exportedAt: Date.now(), ...data }
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const dateStr = new Date().toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = url
  a.download = `billiard-${data.code ?? 'backup'}-${dateStr}.json`
  a.click()

  URL.revokeObjectURL(url)
}

/** Parse + validate tối thiểu cấu trúc file backup. Trả về null nếu không hợp lệ. */
export function parseBackup(json: string): BackupData | null {
  let obj: unknown
  try {
    obj = JSON.parse(json)
  } catch {
    return null
  }

  if (!obj || typeof obj !== 'object') return null
  const b = obj as Partial<BackupData>

  const validTeams =
    Array.isArray(b.teams) &&
    b.teams.every(
      (t) => t && typeof t.id === 'string' && typeof t.name === 'string',
    )
  const validMatches =
    Array.isArray(b.matches) &&
    b.matches.every((m) => m && typeof m.id === 'string' && typeof m.round === 'number')
  const validConfig =
    b.config != null &&
    typeof b.config.winPoints === 'number' &&
    typeof b.config.raceTo === 'number'

  if (!validTeams || !validMatches || !validConfig) return null

  return {
    version: 1,
    exportedAt: typeof b.exportedAt === 'number' ? b.exportedAt : Date.now(),
    code: typeof b.code === 'string' ? b.code : null,
    config: b.config as TournamentConfig,
    teams: b.teams as Team[],
    matches: b.matches as Match[],
  }
}
