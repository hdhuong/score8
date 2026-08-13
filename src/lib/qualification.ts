import type { Match, StandingRow, Team, TournamentConfig } from '../types'
import { getStandings } from './standings'

export type QualificationStatus = 'guaranteed' | 'eliminated' | 'contested'

export interface QualificationAnalysis {
  teamId: string
  currentRank: number
  totalTeams: number
  status: QualificationStatus
  /** Các trận vòng bảng của chính đội này còn chưa đấu. */
  remainingOwnMatches: { matchId: string; opponentId: string; opponentName: string }[]
  /** Tổng số trận vòng bảng còn lại của CẢ giải (kể cả không liên quan đội này). */
  totalRemainingMatches: number
  /**
   * Số trận tối thiểu đội này cần thắng thêm để CHẮC CHẮN vào top N, bất kể
   * kết quả các trận khác ra sao. `null` nếu không tồn tại phương án nào đảm
   * bảo 100% (vẫn có thể vào top N nhưng phụ thuộc kết quả đội khác).
   */
  minWinsForGuarantee: number | null
  /** Đối thủ bắt buộc phải thắng trong MỌI phương án đạt `minWinsForGuarantee`. */
  mustBeatTeamIds: string[]
}

/**
 * Phân tích khả năng vào top N (mặc định 2, tương ứng "vào chung kết") của
 * 1 đội, dựa trên các trận vòng bảng còn lại.
 *
 * Cách làm: vét cạn (brute-force) mọi kết quả thắng/thua có thể của các trận
 * còn lại — khả thi vì giải chỉ có 5-6 đội (tối đa ~15 trận vòng bảng, đội
 * nhiều trận còn lại nhất cũng chỉ ~5 trận của chính mình). Tỷ số mô phỏng
 * dùng race-to/0 (thắng đậm nhất) làm quy ước — kết quả tie-break theo hiệu
 * số ván thực tế có thể khác nếu tỷ số sít sao hơn.
 */
export function analyzeQualification(
  teams: Team[],
  matches: Match[],
  config: TournamentConfig,
  targetTeamId: string,
  topN = 2,
): QualificationAnalysis {
  const groupMatches = matches.filter((m) => m.stage !== 'final')
  const remaining = groupMatches.filter((m) => m.status !== 'completed')
  const own = remaining.filter(
    (m) => m.team1Id === targetTeamId || m.team2Id === targetTeamId,
  )
  const others = remaining.filter((m) => !own.includes(m))

  const currentStandings = getStandings(teams, matches, config)
  const currentRank = rankOf(currentStandings, targetTeamId) ?? teams.length

  const remainingOwnMatches = own.map((m) => {
    const opponentId = m.team1Id === targetTeamId ? m.team2Id : m.team1Id
    return {
      matchId: m.id,
      opponentId,
      opponentName: teams.find((t) => t.id === opponentId)?.name ?? '?',
    }
  })

  if (remaining.length === 0) {
    const qualified = currentRank <= topN
    return {
      teamId: targetTeamId,
      currentRank,
      totalTeams: teams.length,
      status: qualified ? 'guaranteed' : 'eliminated',
      remainingOwnMatches: [],
      totalRemainingMatches: 0,
      minWinsForGuarantee: qualified ? 0 : null,
      mustBeatTeamIds: [],
    }
  }

  // rankFor(ownWins, otherTeam1Wins): giả lập kết quả rồi trả rank của target.
  const rankFor = (ownWins: boolean[], otherTeam1Wins: boolean[]): number => {
    const overrides = new Map<string, Match>()
    own.forEach((m, i) => {
      const targetWins = ownWins[i]
      const team1Wins = m.team1Id === targetTeamId ? targetWins : !targetWins
      overrides.set(m.id, simulateMatch(m, team1Wins, config.raceTo))
    })
    others.forEach((m, i) => {
      overrides.set(m.id, simulateMatch(m, otherTeam1Wins[i], config.raceTo))
    })
    const simulated = matches.map((m) => overrides.get(m.id) ?? m)
    const standings = getStandings(teams, simulated, config)
    return rankOf(standings, targetTeamId)!
  }

  const ownCombos = allBoolCombos(own.length)
  const otherCombos = allBoolCombos(others.length)

  let canQualifyAtAll = false
  const guaranteeCombos: boolean[][] = []

  for (const ownWins of ownCombos) {
    let allQualify = true
    let anyQualify = false
    for (const otherBits of otherCombos) {
      const rank = rankFor(ownWins, otherBits)
      if (rank <= topN) anyQualify = true
      else allQualify = false
    }
    if (anyQualify) canQualifyAtAll = true
    if (allQualify) guaranteeCombos.push(ownWins)
  }

  if (!canQualifyAtAll) {
    return {
      teamId: targetTeamId,
      currentRank,
      totalTeams: teams.length,
      status: 'eliminated',
      remainingOwnMatches,
      totalRemainingMatches: remaining.length,
      minWinsForGuarantee: null,
      mustBeatTeamIds: [],
    }
  }

  if (guaranteeCombos.length === 0) {
    return {
      teamId: targetTeamId,
      currentRank,
      totalTeams: teams.length,
      status: 'contested',
      remainingOwnMatches,
      totalRemainingMatches: remaining.length,
      minWinsForGuarantee: null,
      mustBeatTeamIds: [],
    }
  }

  const minWins = Math.min(...guaranteeCombos.map(countWins))
  const bestCombos = guaranteeCombos.filter((c) => countWins(c) === minWins)
  const mustBeatTeamIds = own
    .filter((_, i) => bestCombos.every((c) => c[i]))
    .map((m) => (m.team1Id === targetTeamId ? m.team2Id : m.team1Id))

  return {
    teamId: targetTeamId,
    currentRank,
    totalTeams: teams.length,
    status: minWins === 0 ? 'guaranteed' : 'contested',
    remainingOwnMatches,
    totalRemainingMatches: remaining.length,
    minWinsForGuarantee: minWins,
    mustBeatTeamIds,
  }
}

function simulateMatch(m: Match, team1Wins: boolean, raceTo: number): Match {
  return {
    ...m,
    score1: team1Wins ? raceTo : 0,
    score2: team1Wins ? 0 : raceTo,
    status: 'completed',
  }
}

function rankOf(standings: StandingRow[], teamId: string): number | undefined {
  return standings.find((r) => r.teamId === teamId)?.rank
}

function countWins(combo: boolean[]): number {
  return combo.filter(Boolean).length
}

function allBoolCombos(n: number): boolean[][] {
  const out: boolean[][] = []
  for (let mask = 0; mask < 1 << n; mask++) {
    out.push(Array.from({ length: n }, (_, i) => Boolean(mask & (1 << i))))
  }
  return out
}
