function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Inline formatting runs on already-escaped text. Images before links
// (both use the [] () shape). Placeholders are not needed because the
// replacements do not re-introduce markdown syntax.
function inline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let para: string[] = []
  let list: string[] = []

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(escapeHtml(para.join(' ')))}</p>`)
      para = []
    }
  }
  const flushList = () => {
    if (list.length) {
      out.push(`<ul>${list.map(i => `<li>${inline(escapeHtml(i))}</li>`).join('')}</ul>`)
      list = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '') {
      flushPara()
      flushList()
      continue
    }
    if (/^-{2,}$/.test(trimmed)) {
      flushPara()
      flushList()
      out.push('<hr>')
      continue
    }
    const headingMatch = /^(#{1,6})\s/.exec(trimmed)
    if (headingMatch) {
      flushPara()
      flushList()
      const level = headingMatch[1].length
      const content = trimmed.slice(level + 1).trim()
      out.push(`<h${level}>${inline(escapeHtml(content))}</h${level}>`)
      continue
    }
    if (trimmed.startsWith('> ')) {
      flushPara()
      flushList()
      out.push(`<blockquote>${inline(escapeHtml(trimmed.slice(2)))}</blockquote>`)
      continue
    }
    if (trimmed.startsWith('- ')) {
      flushPara()
      list.push(trimmed.slice(2))
      continue
    }
    flushList()
    para.push(trimmed)
  }
  flushPara()
  flushList()
  return out.join('')
}
