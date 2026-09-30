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
}
