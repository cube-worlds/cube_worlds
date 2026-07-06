import { Buffer } from 'node:buffer'
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseFrontMatter } from './landing/frontmatter'
import { renderMarkdown } from './landing/markdown'
import { renderTemplate } from './landing/template'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(ROOT, '../src/landing/src')
const PUBLIC = path.join(ROOT, '../src/landing/public')
const OUT = path.join(ROOT, '../src/landing/dist')

interface Site {
  brand: string
  telegramBot: string
  contact: string
  baseUrl: string
  nav: { slug: string, label: string }[]
  footer: { slug: string, label: string }[]
  metricsFallback: Record<string, string>
}

async function readText(p: string): Promise<string> {
  return readFile(p, 'utf-8')
}

function href(slug: string): string {
  return slug === '' ? '/' : `/${slug}/`
}

function navLinksHtml(site: Site, active: string): string {
  return site.nav
    .map((n) => {
      const cls = n.slug === active ? ' class="active"' : ''
      return `<a href="${href(n.slug)}"${cls}>${n.label}</a>`
    })
    .join('\n      ')
}

function footerLinksHtml(site: Site): string {
  return site.footer
    .map(n => `<a href="${href(n.slug)}">${n.label}</a>`)
    .join('\n      ')
}

async function main() {
  const site: Site = JSON.parse(await readText(path.join(SRC, 'data/site.json')))
  const layout = await readText(path.join(SRC, 'layout.html'))
  const partials = {
    nav: await readText(path.join(SRC, 'partials/nav.html')),
    footer: await readText(path.join(SRC, 'partials/footer.html')),
  }

  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })

  const urls: string[] = []

  const emit = async (
    outRel: string,
    content: string,
    meta: { title: string, description: string, active?: string, extraCss?: string },
  ) => {
    const html = renderTemplate(
      layout,
      {
        title: meta.title,
        description: meta.description,
        extraCss: meta.extraCss ?? '',
        content,
        navLinks: navLinksHtml(site, meta.active ?? ''),
        footerLinks: footerLinksHtml(site),
      },
      partials,
    )
    const outPath = path.join(OUT, outRel)
    await mkdir(path.dirname(outPath), { recursive: true })
    await writeFile(outPath, html)
    const url = outRel.replace(/index\.html$/, '').replace(/\\/g, '/')
    urls.push(`/${url}`)
  }

  // 1) HTML page fragments in pages/
  const pageDir = path.join(SRC, 'pages')
  for (const file of await readdir(pageDir)) {
    if (!file.endsWith('.html')) {
      continue
    }
    const name = file.replace(/\.html$/, '')
    const raw = await readText(path.join(pageDir, file))
    const { data, body } = parseFrontMatter(raw)
    const outRel = name === 'home' ? 'index.html' : path.join(name, 'index.html')
    await emit(outRel, body, {
      title: data.title ?? site.brand,
      description: data.description ?? '',
      active: data.active,
      extraCss: data.extraCss === 'app'
        ? '<link rel="stylesheet" href="/styles/app-preview.css">'
        : '',
    })
  }

  // 2) Markdown content: history + legal (single files → <slug>/index.html)
  const renderMdFile = async (file: string, outRel: string, active: string) => {
    const raw = await readText(file)
    const { data, body } = parseFrontMatter(raw)
    const article = `<section><div class="wrap" style="max-width:820px;">${renderMarkdown(body)}</div></section>`
    await emit(outRel, article, {
      title: data.title ?? site.brand,
      description: data.description ?? '',
      active,
      extraCss: data.extraCss === 'app'
        ? '<link rel="stylesheet" href="/styles/app-preview.css">'
        : '',
    })
  }

  const historyDir = path.join(SRC, 'content/history')
  for (const file of await readdir(historyDir)) {
    if (!file.endsWith('.md')) {
      continue
    }
    const name = file.replace(/\.md$/, '')
    const outRel = name === 'index' ? path.join('history', 'index.html') : path.join('history', name, 'index.html')
    await renderMdFile(path.join(historyDir, file), outRel, 'history')
  }

  const legalDir = path.join(SRC, 'content/legal')
  for (const file of await readdir(legalDir)) {
    if (!file.endsWith('.md')) {
      continue
    }
    const name = file.replace(/\.md$/, '')
    await renderMdFile(path.join(legalDir, file), path.join(name, 'index.html'), '')
  }

  // 3) Blog: posts + generated index
  const blogDir = path.join(SRC, 'content/blog')
  const posts: { slug: string, title: string, date: string, description: string }[] = []
  for (const file of await readdir(blogDir)) {
    if (!file.endsWith('.md')) {
      continue
    }
    const raw = await readText(path.join(blogDir, file))
    const { data, body } = parseFrontMatter(raw)
    const slug = data.slug ?? file.replace(/\.md$/, '')
    const outPath = path.join(OUT, 'blog', slug, 'index.html')
    if (!outPath.startsWith(OUT + path.sep)) {
      throw new Error(`Unsafe slug in ${file}: ${slug}`)
    }
    posts.push({ slug, title: data.title ?? slug, date: data.date ?? '', description: data.description ?? '' })
    const article = `<section><div class="wrap" style="max-width:820px;">`
      + `<p class="hero-sub" style="margin:0 0 1rem;">${data.date ?? ''}</p>`
      + `${renderMarkdown(body)}`
      + `<p style="margin-top:2rem;"><a href="/blog/">← Back to devlog</a></p></div></section>`
    await emit(path.join('blog', slug, 'index.html'), article, {
      title: `${data.title ?? slug} — Cube Worlds`,
      description: data.description ?? '',
      active: 'blog',
    })
  }
  posts.sort((a, b) => (a.date < b.date ? 1 : -1))
  const blogList = posts
    .map(p => `<a class="feature" style="text-decoration:none;display:block;" href="/blog/${p.slug}/">`
      + `<h3>${p.title}</h3><p class="hero-sub" style="margin:0 0 0.5rem;">${p.date}</p>`
      + `<p>${p.description}</p></a>`)
    .join('\n')
  const blogIndex = `<section><div class="wrap">`
    + `<div class="section-head"><div class="eyebrow">Devlog</div><h2>Build updates</h2></div>`
    + `<div class="feature-grid">${blogList}</div></div></section>`
  await emit(path.join('blog', 'index.html'), blogIndex, {
    title: 'Devlog — Cube Worlds',
    description: 'Development updates from Cube Worlds.',
    active: 'blog',
  })

  // 4) Static assets
  await cp(path.join(SRC, 'styles'), path.join(OUT, 'styles'), { recursive: true })
  await cp(PUBLIC, OUT, { recursive: true })

  // 5) 404 page (styled with chrome)
  const notFound = `<header class="hero"><div class="wrap">`
    + `<h1>404</h1><p class="lead">That page drifted off into the cosmos.</p>`
    + `<div class="hero-cta"><a class="btn btn-primary" href="/">Back home</a></div></div></header>`
  await emit('404.html', notFound, { title: 'Not found — Cube Worlds', description: 'Page not found.' })

  // 6) robots + sitemap
  await writeFile(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site.baseUrl}/sitemap.xml\n`)
  const sitemapUrls = [...new Set(urls)]
    .filter(u => !u.endsWith('404.html'))
    .map(u => `  <url><loc>${site.baseUrl}${u}</loc></url>`)
    .join('\n')
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls}\n</urlset>\n`
  await writeFile(path.join(OUT, 'sitemap.xml'), sitemap)

  process.stdout.write(`Landing built: ${new Set(urls).size} pages → ${path.relative(process.cwd(), OUT)}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})
void Buffer // keep import used if tree-shaken in future; harmless
