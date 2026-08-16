// The EDITOR's half of the owner tour. Split from `tour-flows-admin.ts` on 2026-08-15, on the
// same seam that file was split from `tour-flows.ts` on and for the same reason: the 400-line
// cap came due, and the cut is by READER rather than by size.
//
// What lives here is every flow that opens `/admin/editor` and drives the FORM — the title
// field, the unsaved marker, the local recovery copy, a save, a publish, a rename. What stays
// next door is the admin's other nine screens, which the editor knows nothing about.
//
// These are the flows that talk to the CLIENT rather than to the API, which is the whole point
// of having them: the rename bug of 2026-08-15 saved the post correctly, answered 200 to every
// request, and still threw the editor away for a red "Not found". No API-level assertion could
// have seen it.

import type { Tour } from './tour'

export function registerEditorFlows({ flow, expect }: Tour): void {


  flow('admin: the editor opens with a title field and a body', () => expect('/admin/editor', `
    (() => {
      const title = document.querySelector('textarea[placeholder], input[placeholder]')
      const body = document.querySelector('.ProseMirror')
      if (!title) return 'no title field'
      if (!body) return 'no editor surface'
      return 'ok'
    })()`, 1200))

  flow('admin: typing marks the post unsaved', () => expect('/admin/editor', `
    (async () => {
      localStorage.clear()
      const ta = document.querySelector('textarea')
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
      ta.focus(); set.call(ta, 'Tour: a post typed by a script')
      ta.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 300))
      return /nsaved|ưa lưu/.test(document.body.innerText) ? 'ok' : 'the save bar never said unsaved'
    })()`, 1200))

  flow('admin: leaving the editor keeps the work on this device', () => expect('/admin/editor', `
    (async () => {
      localStorage.clear()
      const ta = document.querySelector('textarea')
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
      ta.focus(); set.call(ta, 'Tour: work that must survive')
      ta.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 200))
      // The flush that makes a two-minute interval safe.
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
      await new Promise((r) => setTimeout(r, 300))
      const kept = Object.keys(localStorage).length > 0
      const said = /this device|máy này|Gerät|端末|本机|기기/.test(document.body.innerText)
      if (!kept) return 'nothing was written to localStorage'
      return said ? 'ok' : 'a snapshot exists but the bar does not mention it'
    })()`, 1200))

  flow('admin: a draft saves and appears in the list', () => expect('/admin/editor', `
    (async () => {
      const slug = 'tour-draft-' + Date.now()
      const r = await fetch('/api/posts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Tour draft', slug, content: 'Written by the tour.', status: 'draft', categories: [], tags: [] }),
      })
      if (!r.ok) return 'POST /api/posts -> ' + r.status
      const list = await (await fetch('/api/admin/view/content')).json()
      const posts = list?.data?.posts ?? []
      const found = posts.some((p) => p.slug === slug)
      // Clean up after ourselves: a tour that leaves rows behind changes the next run.
      await fetch('/api/posts/' + slug, { method: 'DELETE' })
      return found ? 'ok' : 'the new draft was not in the content list'
    })()`, 900))

  flow('admin: a published post is reachable publicly', () => expect('/admin/editor', `
    (async () => {
      const slug = 'tour-live-' + Date.now()
      const r = await fetch('/api/posts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Tour live', slug, content: 'Live from the tour.', status: 'published', categories: [], tags: [] }),
      })
      if (!r.ok) return 'POST /api/posts -> ' + r.status
      const page = await fetch('/' + slug)
      const html = page.ok ? await page.text() : ''
      await fetch('/api/posts/' + slug, { method: 'DELETE' })
      if (!page.ok) return 'the published post answered ' + page.status
      return html.includes('Live from the tour') ? 'ok' : 'the page rendered without its body'
    })()`, 900))

  // The bug this catches was invisible to every flow above, because all of them talk to the
  // API and this one is a defect in the CLIENT: the post saves, the URL updates, and the shell
  // then throws the editor away for a red "Not found". So it drives the real form.
  //
  // `pushState` + a synthetic `popstate` rather than `location.href`: the second is a reload,
  // which kills the async expression mid-flight. The router listens for `popstate`, so this is
  // a real SPA navigation.
  flow('admin: renaming a draft\'s slug and publishing keeps the editor', () => expect('/admin/editor', `
    (async () => {
      const slug = 'tour-rename-' + Date.now()
      const r = await fetch('/api/posts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Tour rename', slug, content: 'Renamed by the tour.', status: 'draft', categories: [], tags: [] }),
      })
      if (!r.ok) return 'POST /api/posts -> ' + r.status
      const done = async (verdict) => {
        await fetch('/api/posts/' + slug, { method: 'DELETE' })
        await fetch('/api/posts/' + slug + '-moved', { method: 'DELETE' })
        return verdict
      }
      history.pushState(null, '', '/admin/editor/' + slug)
      dispatchEvent(new PopStateEvent('popstate'))
      await new Promise((r) => setTimeout(r, 1200))

      // The attributes are CLOSED while writing (ADR 0024, step 5), so the slug field is not
      // on screen yet: pressing Publish on a never-published draft opens them. That press is
      // now part of this flow's path, and it is the step being tested as much as the rename.
      const header = [...document.querySelectorAll('button')].find((b) => /publish/i.test(b.textContent || ''))
      if (!header) return done('no publish button in the action bar')
      header.click()
      await new Promise((r) => setTimeout(r, 500))

      const field = [...document.querySelectorAll('input')].filter((i) => i.type === 'text')
        .find((i) => i.value === slug)
      if (!field) return done('pressing Publish did not open the attributes on the new draft')
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      set.call(field, slug + '-moved')
      field.dispatchEvent(new Event('input', { bubbles: true }))

      // The LAST one: the header's button opened the panel, and the panel carries the one
      // that finishes the job.
      const publish = [...document.querySelectorAll('button')].filter((b) => /publish/i.test(b.textContent || '')).pop()
      if (!publish) return done('no publish button in the attributes panel')
      publish.click()
      await new Promise((r) => setTimeout(r, 1800))

      // Three things at once, because the defect broke all three and fixing one is not enough.
      const saved = (await fetch('/api/admin/view/editor?slug=' + slug + '-moved')).status
      const stillEditing = [...document.querySelectorAll('input')].some((i) => i.type === 'radio')
      const shouted = [...document.querySelectorAll('*')]
        .some((e) => e.children.length === 0 && /not found/i.test(e.textContent || ''))
      if (saved !== 200) return done('the renamed post did not save: ' + saved)
      if (shouted) return done('the shell showed "Not found" for a post that saved')
      if (!stillEditing) return done('the editor was thrown away after its own save')
      return done('ok')
    })()`, 900))

  // The owner found this one by writing: selecting the FIRST line put the formatting bar
  // under the sticky toolbar, covered and unclickable, so the opening sentence of a post was
  // the one sentence he could not format. Asserted with `elementFromPoint` rather than by
  // comparing rectangles: what matters is not whether they overlap, it is which one the mouse
  // would actually hit.
  flow('admin: the formatting bar is reachable on the FIRST line', () => expect('/admin/editor', `
    (async () => {
     try {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const slug = 'tour-bubble-' + Date.now()
      const made = await fetch('/api/posts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Tour bubble', slug, content: 'The first line of the post.\\n\\nAnd a second paragraph.', status: 'draft', categories: [], tags: [] }),
      })
      const done = async (verdict) => { await fetch('/api/posts/' + slug, { method: 'DELETE' }); return verdict }
      if (!made.ok) return 'POST /api/posts -> ' + made.status
      history.pushState(null, '', '/admin/editor/' + slug)
      dispatchEvent(new PopStateEvent('popstate'))
      await sleep(1200)

      const surface = document.querySelector('[contenteditable="true"]')
      if (!surface) return done('the editor rendered no writing surface')
      const first = surface.querySelector('p')
      if (!first) return done('the editor rendered no paragraph')
      window.scrollTo(0, 0)
      surface.focus()
      const range = document.createRange()
      range.selectNodeContents(first)
      const sel = window.getSelection()
      if (!sel) return done('this browser reported no selection object')
      sel.removeAllRanges()
      sel.addRange(range)
      surface.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      await sleep(700)

      // The B button's PARENT. Scanning divs for one that contains a B finds the page
      // wrapper first — it contains everything, including the bar — and then every geometry
      // assertion below is measured on the whole screen and passes for the wrong reason.
      // The toolbar has no B any more (its formatting moved here), so this button is unique.
      const boldBtn = [...document.querySelectorAll('button')]
        .find((b) => b.querySelector('strong') && (b.textContent || '').trim() === 'B')
      const bar = boldBtn && boldBtn.parentElement
      if (!bar) return done('no formatting bar appeared for a selection on the first line')
      const box = bar.getBoundingClientRect()
      if (box.top < 0) return done('the formatting bar sits above the window, at ' + Math.round(box.top))
      const onTop = document.elementFromPoint(box.left + 10, box.top + box.height / 2)
      if (!bar.contains(onTop)) {
        return done('something else takes the click over the bar: ' + (onTop ? onTop.className || onTop.tagName : 'nothing'))
      }
      return done('ok (bar at y=' + Math.round(box.top) + ')')
     } catch (e) { return 'the flow itself threw: ' + (e && e.message) }
    })()`, 1200))

}
