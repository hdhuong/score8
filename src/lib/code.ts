/** Sinh "mã giải" 6 ký tự dễ đọc (bỏ các ký tự dễ nhầm: 0/O, 1/I). */
export function generateTournamentCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return code
}
