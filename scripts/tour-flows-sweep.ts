// Flows for what the eight-agent sweep of 2026-09-30 found, each one a fault a real reader or
// owner hit and no existing flow asked about. One flow per fault, named for what must hold.
import type { Tour } from './tour'

/** Solve a comment stamp in the page, the way the island does, and wait out its floor. */
const SOLVE = `
  async function solveStamp(stamp) {
    const enc = new TextEncoder()
    for (let n = 0; n < stamp.range; n++) {
      const d = await crypto.subtle.digest('SHA-256', enc.encode(stamp.salt + n))
      const hex = [...new Uint8Array(d, 0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('')
      if (hex === stamp.target.slice(0, 16)) {
        const age = Date.now() - stamp.issued
        if (age < 3200) await new Promise((r) => setTimeout(r, 3200 - age))
        return { ...stamp, answer: n }
      }
    }
    return null
  }`

export function registerSweepFlows({ flow, expect }: Tour): void {
  // The page is cached, so every reader of a post is handed the same challenge, and the first
  // comment spends it. Every reader after that got "Verification failed" until the cache let
  // go: the server said 400 for a spent stamp and the island only recovers from a 409, whose
  // retry also read the stamp off the wrong level of the envelope and sent it too young.
  flow('a second and third reader can comment on a cached page', () => expect('/the-reed-pen-in-van-goghs-letters', `
    (async () => {
      ${SOLVE}
      const root = document.querySelector('#comments')
      if (!root || !root.dataset.stamp) return 'no comment mount with a stamp on the page'
      const slug = root.dataset.post
      const decode = (s) => JSON.parse(s.replace(/&quot;/g, '"').replace(/&amp;/g, '&'))
      // Reader A, somewhere else, answers the SAME challenge this page carries and spends it.
      const again = (await (await fetch(location.pathname)).text()).match(/data-stamp="([^"]*)"/)
      if (!again || decode(again[1]).salt !== JSON.parse(root.dataset.stamp).salt) {
        return 'the page was not served from the cache, so this flow tests nothing'
      }
      const first = await fetch('/api/comments', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          postSlug: slug, name: 'Reader A', email: 'a@example.com',
          content: 'Reader A spent the shared challenge.', stamp: await solveStamp(JSON.parse(root.dataset.stamp)),
        }),
      })
      if (!first.ok) return 'reader A was refused: ' + first.status

      // Readers B and C, through the form itself.
      root.scrollIntoView()
      const until = async (test, ms) => {
        for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 150))) {
          if (test()) return true
        }
        return false
      }
      if (!(await until(() => root.querySelector('.comment-form'), 8000))) return 'the comment form never appeared'
      for (const who of ['Reader B', 'Reader C']) {
        const form = root.querySelector(':scope > .comment-form') || root.querySelector('.comment-form')
        const set = (name, value) => {
          const input = form.querySelector('[name=' + name + ']')
          input.value = value
          input.dispatchEvent(new Event('input', { bubbles: true }))
        }
        set('name', who)
        set('email', who.replace(' ', '').toLowerCase() + '@example.com')
        set('content', who + ' was here after the challenge was spent.')
        form.querySelector('button[type=submit]').click()
        const landed = await until(() => [...root.querySelectorAll('.comment-name')].some((n) => n.textContent === who), 15000)
        if (!landed) return who + ' was refused: "' + (form.querySelector('.comment-status')?.textContent ?? '') + '"'
      }
      return 'ok (A by hand, B and C through the form)'
    })()`, 1500))

  // Save on a live post saved it as a DRAFT: ⌘S to fix a typo took the post off the site (200 →
  // 404) and said "Draft saved". And Preview saved first, so a half-typed sentence went live the
  // moment the writer asked how it read. A post of its own, cleaned up by the last of the three.
  // `no-store` on every read of the public page: the browser keeps the first answer otherwise,
  // and the flow would be testing its own cache.
  const LIVE = 'tour-live-post-keeps-living'
  flow('a live post for the save flows', () => expect('/admin', `
    (async () => {
      const r = await fetch('/api/posts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Tour live post keeps living', content: 'Words the readers see.', status: 'published', date: '2020-01-01T00:00:00.000Z' }),
      })
      if (!r.ok) return 'could not create the live post: ' + r.status
      return (await fetch('/${LIVE}')).status === 200 ? 'ok' : 'the new post is not public'
    })()`))

  flow('admin: ⌘S on a live post saves it and leaves it live', () => expect(`/admin/editor/${LIVE}`, `
    (async () => {
      const key = document.querySelector('[data-sheet-save]')
      if (!key) return 'no Save key'
      if (key.textContent !== key.dataset.saySave) return 'the key on a live post reads "' + key.textContent + '", not "' + key.dataset.saySave + '"'
      const ta = document.querySelector('[data-sheet-title]')
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
      ta.focus(); set.call(ta, ta.value + ' (typo fixed)')
      ta.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 200))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true, ctrlKey: true, bubbles: true, cancelable: true }))
      await new Promise((r) => setTimeout(r, 1500))
      const live = await fetch('/${LIVE}', { cache: 'no-store' })
      if (live.status !== 200) return 'the post answers ' + live.status + ' after ⌘S: Save took it off the site'
      return (await live.text()).includes('typo fixed') ? 'ok' : 'the post stayed live but the save never landed'
    })()`, 1500))

  flow('admin: Preview on a live post leaves the public page as it was', () => expect(`/admin/editor/${LIVE}`, `
    (async () => {
      const ta = document.querySelector('[data-sheet-title]')
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
      ta.focus(); set.call(ta, 'HALF-WRITTEN title nobody saved')
      ta.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 200))
      const preview = document.querySelector('[data-sheet-preview]')
      if (!preview) return 'no Preview key'
      preview.click()
      await new Promise((r) => setTimeout(r, 1500))
      const live = await (await fetch('/${LIVE}', { cache: 'no-store' })).text()
      const leaked = live.includes('HALF-WRITTEN')
      // Clean up: the post leaves the site and the database, so the next run starts clean.
      await fetch('/api/posts/${LIVE}', { method: 'DELETE' })
      await fetch('/api/trash', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'posts', action: 'purge', ids: ['${LIVE}'] }),
      })
      return leaked ? 'Preview put the unsaved title on the public page' : 'ok'
    })()`, 1500))
}
