export interface FrontMatter {
  data: Record<string, string>
  body: string
}

export function parseFrontMatter(raw: string): FrontMatter {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(raw)
  if (!match) {
    return { data: {}, body: raw }
  }
  const data: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) {
      continue
    }
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (key) {
      data[key] = value
    }
  }
  return { data, body: raw.slice(match[0].length) }
}
