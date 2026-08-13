// Vercel Edge Function — proxy tới Gemini.
//
// Giữ GEMINI_API_KEY ở server (biến môi trường Vercel), KHÔNG bao giờ set
// dạng VITE_* vì mọi biến VITE_* bị nhúng thẳng vào bundle client và ai cũng
// đọc được. Set qua: Vercel dashboard > Project Settings > Environment
// Variables (hoặc `vercel env add GEMINI_API_KEY` khi dùng vercel CLI).
//
// Client KHÔNG tự soạn prompt — chỉ gửi số liệu đã tính sẵn (deterministic,
// xem src/lib/qualification.ts). Function này soạn prompt cố định từ số liệu
// đó, tránh việc model tự "bịa" thêm số liệu hoặc bị prompt injection từ input.
//
// File nằm ở api/analyze-team.ts -> Vercel tự map route thành
// /api/analyze-team, khớp với đường dẫn client đang gọi trong
// src/lib/aiAnalysis.ts — không cần cấu hình route thủ công.

export const config = { runtime: 'edge' }

interface AnalyzeTeamRequest {
  teamName: string
  totalTeams: number
  currentRank: number
  status: 'guaranteed' | 'eliminated' | 'contested'
  remainingOpponentNames: string[]
  minWinsForGuarantee: number | null
  mustBeatTeamNames: string[]
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function isValidRequest(body: unknown): body is AnalyzeTeamRequest {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  return (
    typeof b.teamName === 'string' &&
    b.teamName.length <= 100 &&
    typeof b.totalTeams === 'number' &&
    typeof b.currentRank === 'number' &&
    (b.status === 'guaranteed' || b.status === 'eliminated' || b.status === 'contested') &&
    Array.isArray(b.remainingOpponentNames) &&
    b.remainingOpponentNames.length <= 20 &&
    b.remainingOpponentNames.every((n) => typeof n === 'string' && n.length <= 100) &&
    (b.minWinsForGuarantee === null || typeof b.minWinsForGuarantee === 'number') &&
    Array.isArray(b.mustBeatTeamNames) &&
    b.mustBeatTeamNames.length <= 20 &&
    b.mustBeatTeamNames.every((n) => typeof n === 'string' && n.length <= 100)
  )
}

function buildPrompt(req: AnalyzeTeamRequest): string {
  const statusText: Record<AnalyzeTeamRequest['status'], string> = {
    guaranteed: 'Đã chắc chắn vào vòng trong (top 2), bất kể kết quả các trận còn lại của giải.',
    eliminated: 'Đã hết cơ hội vào vòng trong (top 2), dù kết quả các trận còn lại ra sao.',
    contested: 'Vẫn còn cơ hội vào vòng trong (top 2), nhưng chưa chắc chắn 100%.',
  }

  const lines = [
    `Bạn là bình luận viên giải billiard phong trào. Dựa DUY NHẤT vào dữ liệu bên dưới, viết đoạn văn ngắn 3-5 câu bằng tiếng Việt, giọng tự nhiên, dễ hiểu cho người chơi, không dùng markdown, không bịa thêm số liệu nào ngoài dữ liệu được cung cấp.`,
    ``,
    `Dữ liệu:`,
    `- Đội: ${req.teamName}`,
    `- Hạng hiện tại: ${req.currentRank}/${req.totalTeams}`,
    `- Trạng thái: ${statusText[req.status]}`,
    `- Số trận vòng bảng còn lại của đội: ${req.remainingOpponentNames.length}${req.remainingOpponentNames.length > 0 ? `, gặp lần lượt: ${req.remainingOpponentNames.join(', ')}` : ''}`,
  ]

  if (req.status === 'contested') {
    lines.push(
      req.minWinsForGuarantee != null
        ? `- Số trận tối thiểu cần thắng thêm để CHẮC CHẮN vào top 2 (bất kể đội khác thắng/thua ra sao): ${req.minWinsForGuarantee}`
        : `- Không có phương án nào tự thân đảm bảo 100% — đội cần thắng các trận còn lại VÀ cần kết quả thuận lợi từ các đội khác.`,
    )
    if (req.mustBeatTeamNames.length > 0) {
      lines.push(`- Đối thủ bắt buộc phải thắng để đạt phương án chắc chắn kể trên: ${req.mustBeatTeamNames.join(', ')}`)
    }
  }

  return lines.join('\n')
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return jsonResponse({ error: 'GEMINI_API_KEY chưa được cấu hình trên server.' }, 500)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Body không hợp lệ.' }, 400)
  }

  if (!isValidRequest(body)) {
    return jsonResponse({ error: 'Dữ liệu gửi lên không đúng định dạng.' }, 400)
  }

  const model = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  try {
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(body) }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 300 },
      }),
    })

    if (!geminiRes.ok) {
      console.error('Gemini API error', geminiRes.status, await geminiRes.text())
      return jsonResponse({ error: 'Gemini tạm thời không phản hồi được.' }, 502)
    }

    const data = await geminiRes.json()
    const text: string =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''

    if (!text) {
      return jsonResponse({ error: 'Gemini không trả về nội dung.' }, 502)
    }

    return jsonResponse({ text }, 200)
  } catch (err) {
    console.error('Gemini fetch failed', err)
    return jsonResponse({ error: 'Không gọi được Gemini.' }, 502)
  }
}
