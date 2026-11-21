export const NOISE = '+=~<>|[](){}\\/!?;:0123456789abcdefijlrtvxzYZS'

export function noiseChar(rand: () => number = Math.random): string {
  return NOISE[Math.floor(rand() * NOISE.length) % NOISE.length]
}

export function bannerRows(cols: number, rows: number, word: string, rand: () => number = Math.random): string[] {
  const mid = Math.floor(rows / 2), at = Math.floor((cols - word.length) / 2)
  const out: string[] = []
  for (let r = 0; r < rows; r++) {
    let row = ''
    for (let c = 0; c < cols; c++) row += rand() < 0.18 && row ? '=' : noiseChar(rand)
    const d = Math.abs(r - mid)
    if (d <= 1) {
      const pad = d === 0 ? 7 : 4 + Math.floor(rand() * 3)
      const from = Math.max(0, at - pad), to = Math.min(cols, at + word.length + pad)
      row = row.slice(0, from) + ' '.repeat(to - from) + row.slice(to)
    }
    if (d === 0) row = row.slice(0, at) + word + row.slice(at + word.length)
    out.push(row)
  }
  return out
}
