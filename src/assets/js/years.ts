// The listing's year index: where its rows point, and which one is lit. See `yearIndex`.

/**
 * The year index in the listing's right gutter, and the same years in the drawer.
 *
 * Each row is written to point at `/archive#yYYYY`, which is right with no script and on a page
 * that holds none of that year. Here the row is pointed at the FIRST post of its year on this
 * page instead, when there is one (the server marks it with `data-yr`), and the row of the year
 * the reader is in is lit as the page scrolls: the first year mark above a line a third of the
 * way down the window. The marks are read afresh on every pass, because an infinite feed adds
 * more of them as it grows.
 */
export function yearIndex(): void {
  const rows = document.querySelectorAll<HTMLAnchorElement>('a[data-year]')
  if (!rows.length) return
  const marks = () => document.querySelectorAll<HTMLElement>('[data-yr]')
  const done = new Set<string>()
  const point = () => {
    for (const m of marks()) {
      const y = m.dataset.yr!
      if (done.has(y)) continue
      done.add(y)
      m.id ||= `y${y}`
      for (const a of rows) if (a.dataset.year === y) a.setAttribute('href', `#${m.id}`)
    }
  }
  let queued = false
  const light = () => {
    queued = false
    point()
    const line = innerHeight / 3
    let now = ''
    for (const m of marks()) {
      if (m.getBoundingClientRect().top > line && now) break
      now = m.dataset.yr!
    }
    for (const a of rows) {
      if (a.dataset.year === now) a.setAttribute('aria-current', 'location')
      else a.removeAttribute('aria-current')
    }
  }
  const soon = () => { if (!queued) { queued = true; requestAnimationFrame(light) } }
  addEventListener('scroll', soon, { passive: true })
  addEventListener('resize', soon, { passive: true })
  light()
}
