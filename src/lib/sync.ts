import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { Match, MatchStatus, Team } from '../types'

// ── Kiểu dữ liệu phía Supabase (snake_case) ────────────────────────────────
interface DbTeam {
  id: string
  code: string
  name: string
  updated_at: string
}

interface DbMatch {
  id: string
  code: string
  round: number
  team1_id: string
  team2_id: string
  score1: number | null
  score2: number | null
  status: string
  updated_at: string
}

function teamToDb(code: string, t: Team): DbTeam {
  return { id: t.id, code, name: t.name, updated_at: new Date(t.updatedAt).toISOString() }
}

function matchToDb(code: string, m: Match): DbMatch {
  return {
    id: m.id,
    code,
    round: m.round,
    team1_id: m.team1Id,
    team2_id: m.team2Id,
    score1: m.score1,
    score2: m.score2,
    status: m.status,
    updated_at: new Date(m.updatedAt).toISOString(),
  }
}

function dbToTeam(r: DbTeam): Team {
  return { id: r.id, name: r.name, updatedAt: new Date(r.updated_at).getTime() }
}

function dbToMatch(r: DbMatch): Match {
  return {
    id: r.id,
    round: r.round,
    team1Id: r.team1_id,
    team2Id: r.team2_id,
    score1: r.score1,
    score2: r.score2,
    status: r.status as MatchStatus,
    updatedAt: new Date(r.updated_at).getTime(),
  }
}

// ── Push ────────────────────────────────────────────────────────────────
export async function pushTeam(code: string, team: Team): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('teams').upsert(teamToDb(code, team))
  if (error) throw error
}

export async function pushMatch(code: string, match: Match): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('matches').upsert(matchToDb(code, match))
  if (error) throw error
}

/** Upsert hàng loạt team/match (mảng rỗng được bỏ qua an toàn). */
export async function pushSnapshot(
  code: string,
  teams: Team[],
  matches: Match[],
): Promise<void> {
  if (!supabase) return
  const jobs = []
  if (teams.length > 0) {
    jobs.push(supabase.from('teams').upsert(teams.map((t) => teamToDb(code, t))))
  }
  if (matches.length > 0) {
    jobs.push(supabase.from('matches').upsert(matches.map((m) => matchToDb(code, m))))
  }
  const results = await Promise.all(jobs)
  for (const r of results) if (r.error) throw r.error
}

// ── Pull ────────────────────────────────────────────────────────────────
export async function pullTournament(
  code: string,
): Promise<{ teams: Team[]; matches: Match[] } | null> {
  if (!supabase) return null

  const [teamsRes, matchesRes] = await Promise.all([
    supabase.from('teams').select('*').eq('code', code),
    supabase.from('matches').select('*').eq('code', code),
  ])

  if (teamsRes.error || matchesRes.error) return null
  const teamRows = teamsRes.data as DbTeam[]
  const matchRows = matchesRes.data as DbMatch[]
  if (!teamRows || teamRows.length === 0) return null

  return {
    teams: teamRows.map(dbToTeam),
    matches: matchRows.map(dbToMatch).sort((a, b) => a.round - b.round),
  }
}

// ── Realtime ────────────────────────────────────────────────────────────
/** Trả về hàm huỷ đăng ký (unsubscribe). */
export function subscribeTournament(
  code: string,
  onTeam: (team: Team) => void,
  onMatch: (match: Match) => void,
): () => void {
  if (!supabase) return () => {}

  const channel = supabase
    .channel(`tournament:${code}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'teams', filter: `code=eq.${code}` },
      (payload: RealtimePostgresChangesPayload<DbTeam>) => {
        if (payload.new && 'id' in payload.new) onTeam(dbToTeam(payload.new))
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'matches', filter: `code=eq.${code}` },
      (payload: RealtimePostgresChangesPayload<DbMatch>) => {
        if (payload.new && 'id' in payload.new) onMatch(dbToMatch(payload.new))
      },
    )
    .subscribe()

  return () => {
    supabase?.removeChannel(channel)
  }
}
