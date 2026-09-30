// Flows for the writing surface, from the 2026-09-30 sweep's writer and client reviews (phase 4
// of the fix list). One flow per fault, named for what must hold.
import type { Tour } from './tour'

/** Make a draft through the API and answer 'ok', so the next flow can open it. */
const draft = (slug: string, title: string, content: string) => `
  (async () => {
    const r = await fetch('/api/posts', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '${title}', slug: '${slug}', content: '${content}', status: 'draft' }) })
    return r.ok ? 'ok' : 'could not create it: ' + r.status
  })()`

/** Throw a flow's draft away for good, so a rerun starts clean. */
const discard = (slug: string) => `
  await fetch('/api/posts/${slug}', { method: 'DELETE' })
  await fetch('/api/trash', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'posts', action: 'purge', ids: ['${slug}'] }) })`

export function registerWriterFlows({ flow, expect }: Tour): void {
  // Without ProseMirror's required CSS the surface was `white-space: normal`, and a space typed
  // after another space, or at the end of a line, was stored as U+00A0: `two\xa0 spaces` in the
  // Markdown, `&nbsp;` on the page. The same held after bold or a formula.
  const SPACES = 'tour-typed-spaces'
  flow('writer: a post to type spaces into', () => expect('/admin', draft(SPACES, 'Tour typed spaces', 'Start.')))
  flow('writer: a typed space is a space, after another space and at the end of a line', () => expect(`/admin/editor/${SPACES}`, `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const surface = document.querySelector('.ProseMirror')
      if (!surface) return 'no writing surface'
      if (getComputedStyle(surface).whiteSpace === 'normal') return 'the surface is white-space: normal'
      surface.focus()
      const p = surface.querySelector('p')
      getSelection().selectAllChildren(p); getSelection().collapseToEnd()
      await sleep(100)
      document.execCommand('insertText', false, ' two  spaces and a last one ')
      await sleep(200)
      const mod = /Mac/.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true }
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ...mod, bubbles: true, cancelable: true }))
      await sleep(1500)
      const post = await (await fetch('/api/posts/${SPACES}', { cache: 'no-store' })).json()
      const content = (post.data || post).content || ''
      ${discard(SPACES)}
      if (!content.includes('two')) return 'the typing never reached the save: ' + JSON.stringify(content)
      return content.includes('\\u00a0') ? 'a no-break space was stored: ' + JSON.stringify(content) : 'ok'
    })()`, 1500))

  // A future date schedules, but the panel's key said "Publish" and the toast "✓ Published"
  // while the bar said "Schedule"; nothing named the zone the date box is read in.
  const LATER = 'tour-a-later-post'
  flow('writer: a draft to schedule', () => expect('/admin', draft(LATER, 'Tour a later post', 'Words for later.')))
  flow('writer: a future date turns Publish into Schedule, and the date names its zone', () => expect(`/admin/editor/${LATER}`, `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const bar = document.querySelector('[data-sheet-publish]')
      const key = document.querySelector('[data-panel-publish]')
      const box = document.querySelector('[data-date-box]')
      if (!bar || !key || !box) return 'no publish keys or date box'
      const label = document.querySelector('label[for="' + box.id + '"]')
      const zoned = label && /\\([^)]+\\)/.test(label.textContent)
      box.value = box.value.replace(/20\\d\\d/, '2099')
      box.dispatchEvent(new Event('input', { bubbles: true }))
      await sleep(200)
      const want = bar.dataset.saySchedule
      const verdict = key.textContent.trim() !== want ? 'the panel key says ' + JSON.stringify(key.textContent.trim())
        : bar.textContent.trim() !== want ? 'the bar says ' + JSON.stringify(bar.textContent.trim())
        : zoned ? 'ok' : 'the date label names no zone: ' + (label ? label.textContent : 'no label')
      ${discard(LATER)}
      return verdict
    })()`, 1500))
}
