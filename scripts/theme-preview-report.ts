// The two things `theme:preview` leaves beside its shots: REPORT.txt, the findings in lines a
// terminal shows, and index.html, a contact sheet with every shot grouped by page and that page's
// findings above its shots. Plain functions over what was captured; nothing here touches disk.
import type { LayoutFinding } from './theme-preview-layout'
import type { Page } from './theme-matrix-instance'

export type ShotRecord = {
  file: string
  page: Page
  palette: string | null
  width: number
  scheme: string
  status: number
  findings: LayoutFinding[]
}

export type RunInfo = { themeId: string; version: string; name: string; seconds: number; clock: string }

/** One finding as found in every scheme and palette it appeared in, so light and dark do not say it twice. */
export type GroupedFinding = { page: string; width: number; kind: string; detail: string; where: string[] }

export function groupFindings(shots: readonly ShotRecord[]): GroupedFinding[] {
  const byKey = new Map<string, GroupedFinding>()
  for (const s of shots) {
    for (const f of s.findings) {
      const key = `${s.page.id}|${s.width}|${f.kind}|${f.detail}`
      const where = `${s.scheme}${s.palette ? ` ${s.palette}` : ''}`
      const g = byKey.get(key)
      if (g) g.where.push(where)
      else byKey.set(key, { page: s.page.id, width: s.width, kind: f.kind, detail: f.detail, where: [where] })
    }
  }
  return [...byKey.values()]
}

export function reportText(info: RunInfo, shots: readonly ShotRecord[]): string {
  const grouped = groupFindings(shots)
  const head = [
    `theme:preview ${info.themeId} ${info.version} (${info.name})`,
    `${shots.length} shots in ${info.seconds}s, clock ${info.clock}`,
    '',
  ]
  if (grouped.length === 0) return [...head, 'no layout findings', ''].join('\n')
  const lines = grouped.map((g) => `${g.page} @ ${g.width}px [${g.where.join(', ')}] ${g.kind} · ${g.detail}`)
  return [...head, `${grouped.length} layout finding${grouped.length === 1 ? '' : 's'}:`, ...lines, ''].join('\n')
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/**
 * The contact sheet. System colours only (`Canvas`, `CanvasText`, `Mark`), so it reads in the
 * author's light or dark without a palette of its own. Shots are links to the full-size file.
 */
export function indexHtml(info: RunInfo, shots: readonly ShotRecord[]): string {
  const grouped = groupFindings(shots)
  const pages = [...new Map(shots.map((s) => [s.page.id, s.page])).values()]
  const sections = pages.map((page) => {
    const mine = shots.filter((s) => s.page.id === page.id)
    const found = grouped.filter((g) => g.page === page.id)
    const list = found.length
      ? `<ul class="findings">${found.map((g) => `<li><b>${esc(g.kind)}</b> at ${g.width}px (${esc(g.where.join(', '))}): ${esc(g.detail)}</li>`).join('')}</ul>`
      : '<p class="clean">No layout findings.</p>'
    const figures = mine.map((s) => `<figure><a href="${esc(s.file)}"><img src="${esc(s.file)}" loading="lazy" alt="${esc(`${page.id} at ${s.width}px, ${s.scheme}`)}"></a>`
      + `<figcaption>${s.width}px · ${esc(s.scheme)}${s.palette ? ` · ${esc(s.palette)}` : ''}${s.findings.length ? ` · ${s.findings.length} finding${s.findings.length === 1 ? '' : 's'}` : ''}</figcaption></figure>`).join('')
    return `<section id="${esc(page.id)}"><h2>${esc(page.id)} <code>${esc(page.path)}</code></h2>${list}<div class="shots">${figures}</div></section>`
  })
  const nav = pages.map((p) => {
    const n = grouped.filter((g) => g.page === p.id).length
    return `<a href="#${esc(p.id)}">${esc(p.id)}${n ? ` (${n})` : ''}</a>`
  }).join(' · ')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(info.name)} ${esc(info.version)}: theme preview</title>
<style>
:root{color-scheme:light dark}
body{font:1rem/1.5 system-ui,sans-serif;margin:0;padding:1.5rem;background:Canvas;color:CanvasText}
nav{margin-block:1rem 2rem}
section{margin-block-end:3rem}
.findings li{background:Mark;color:MarkText;margin-block:.25rem;padding:.125rem .5rem}
.shots{display:flex;flex-wrap:wrap;gap:1rem;align-items:flex-start}
figure{margin:0;max-width:20rem}
img{display:block;max-width:100%;max-height:40rem;object-fit:cover;object-position:top;border:1px solid GrayText}
figcaption{font-size:.875rem;margin-block-start:.25rem}
</style></head><body>
<h1>${esc(info.name)} ${esc(info.version)} <code>${esc(info.themeId)}</code></h1>
<p>${shots.length} shots in ${info.seconds}s, clock pinned at ${esc(info.clock)}. ${grouped.length === 0 ? 'No layout findings.' : `${grouped.length} layout finding${grouped.length === 1 ? '' : 's'}.`}</p>
<nav>${nav}</nav>
${sections.join('\n')}
</body></html>
`
}
