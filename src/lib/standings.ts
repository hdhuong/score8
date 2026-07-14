import type { Match, StandingRow, Team, TournamentConfig } from '../types'

interface H2H {
  pts: number
  diff: number
}

/**
 * Tính bảng xếp hạng từ danh sách trận (chỉ tính trận `completed`).
 *
 * Thứ tự ưu tiên xếp hạng:
 *   1) Match points  = số trận thắng × winPoints
 *   2) Frame difference = framesWon − framesLost
 *   3) Head-to-head  = đối đầu trực tiếp giữa các đội đang bằng nhau
 *                      (mini-bảng chỉ gồm các trận nội bộ nhóm: điểm nội bộ,
 *                       rồi hiệu số nội bộ). Robust cho cả 2 đội lẫn 3+ đội.
 *
 * Đội vẫn bằng nhau sau cả 3 tiêu chí -> đồng hạng (cùng `rank`).
 */
export function getStandings(
  teams: Team[],
  matches: Match[],
  config: TournamentConfig,
): StandingRow[] {
  // Chỉ tính trận vòng bảng — trận chung kết không ảnh hưởng BXH.
  // Dùng `!== 'final'` (không phải `=== 'group'`) để tương thích ngược với
  // dữ liệu cũ đã persist trước khi có field `stage` (stage sẽ là undefined).
  matches = matches.filter((m) => m.stage !== 'final')

  // 1) Số liệu cơ bản từ các trận đã hoàn thành.
  const map = new Map<string, StandingRow>()
  for (const t of teams) {
    map.set(t.id, {
      teamId: t.id,
      name: t.name,
      played: 0,
      won: 0,
      lost: 0,
      framesWon: 0,
      framesLost: 0,
      frameDiff: 0,
      points: 0,
      rank: 0,
    })
  }

  for (const m of matches) {
    if (m.status !== 'completed' || m.score1 == null || m.score2 == null) continue
    const a = map.get(m.team1Id)
    const b = map.get(m.team2Id)
    if (!a || !b) continue

    a.played++
    b.played++
    a.framesWon += m.score1
    a.framesLost += m.score2
    b.framesWon += m.score2
    b.framesLost += m.score1

    if (m.score1 > m.score2) {
      a.won++
      b.lost++
    } else {
      b.won++
      a.lost++
    }
  }

  for (const row of map.values()) {
    row.frameDiff = row.framesWon - row.framesLost
    row.points = row.won * config.winPoints
  }

  const rows = [...map.values()]

  // 2) Sắp theo tiêu chí chính: điểm, rồi hiệu số.
  rows.sort((x, y) => y.points - x.points || y.frameDiff - x.frameDiff)

  // 3) Với từng nhóm đội bằng (điểm, hiệu số): xét đối đầu trực tiếp.
  //    Lưu lại chỉ số h2h để dùng khi gán thứ hạng.
  const h2hByTeam = new Map<string, H2H>()

  let i = 0
  while (i < rows.length) {
    let j = i
    while (
      j + 1 < rows.length &&
      rows[j + 1].points === rows[i].points &&
      rows[j + 1].frameDiff === rows[i].frameDiff
    ) {
      j++
    }

    const group = rows.slice(i, j + 1)
    if (group.length > 1) {
      const h2h = computeHeadToHead(group, matches, config)
      for (const [id, v] of h2h) h2hByTeam.set(id, v)
      group.sort(
        (x, y) =>
          h2h.get(y.teamId)!.pts - h2h.get(x.teamId)!.pts ||
          h2h.get(y.teamId)!.diff - h2h.get(x.teamId)!.diff,
      )
      // Ghi lại thứ tự đã sắp của nhóm vào mảng gốc.
      for (let k = 0; k < group.length; k++) rows[i + k] = group[k]
    }

    i = j + 1
  }

  // 4) Gán thứ hạng (standard competition ranking: 1,2,2,4).
  //    Hai đội cùng hạng khi bằng cả điểm, hiệu số và h2h.
  const zero: H2H = { pts: 0, diff: 0 }
  let rank = 1
  for (let k = 0; k < rows.length; k++) {
    if (k > 0) {
      const prev = rows[k - 1]
      const cur = rows[k]
      const hp = h2hByTeam.get(prev.teamId) ?? zero
      const hc = h2hByTeam.get(cur.teamId) ?? zero
      const same =
        prev.points === cur.points &&
        prev.frameDiff === cur.frameDiff &&
        hp.pts === hc.pts &&
        hp.diff === hc.diff
      if (!same) rank = k + 1
    }
    rows[k].rank = rank
  }

  return rows
}

/**
 * Mini-bảng đối đầu trực tiếp: chỉ tính các trận GIỮA các đội trong nhóm.
 * pts = số trận thắng nội bộ × winPoints; diff = hiệu số ván nội bộ.
 */
function computeHeadToHead(
  group: StandingRow[],
  matches: Match[],
  config: TournamentConfig,
): Map<string, H2H> {
  const ids = new Set(group.map((g) => g.teamId))
  const h = new Map<string, H2H>()
  for (const g of group) h.set(g.teamId, { pts: 0, diff: 0 })

  for (const m of matches) {
    if (m.status !== 'completed' || m.score1 == null || m.score2 == null) continue
    if (!ids.has(m.team1Id) || !ids.has(m.team2Id)) continue

    const a = h.get(m.team1Id)!
    const b = h.get(m.team2Id)!
    a.diff += m.score1 - m.score2
    b.diff += m.score2 - m.score1
    if (m.score1 > m.score2) a.pts += config.winPoints
    else b.pts += config.winPoints
  }

  return h
}

/**
 * Đội vô địch = đội thắng trận `final` đã `completed`. Trả về `null` nếu
 * chưa có trận chung kết hoặc chưa đấu xong.
 */
export function getChampion(teams: Team[], matches: Match[]): Team | null {
  const final = matches.find((m) => m.stage === 'final' && m.status === 'completed')
  if (!final || final.score1 == null || final.score2 == null) return null

  const winnerId = final.score1 > final.score2 ? final.team1Id : final.team2Id
  return teams.find((t) => t.id === winnerId) ?? null
}
