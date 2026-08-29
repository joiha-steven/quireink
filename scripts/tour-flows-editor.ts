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
import { KITCHEN_SINK } from './tour-kitchen-sink'

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

  // Through the SCREEN, and that is the whole point of this one.
  //
  // Every other trash assertion in this suite calls `fetch(..., {method:'DELETE'})`, so the
  // endpoint has been proved since it was written and the BUTTON was never proved at all.
  // There was no button: it went with the old content table on 2026-08-17 and nothing here
  // noticed for thirteen days, until somebody outside opened issue #60. A test that reaches
  // for the API is a test that cannot see a missing control.
  //
  // It clicks a row in the Write pane and stays in the same document — the SPA's own
  // navigation. An iframe was tried first and cannot work: `security-headers.ts` sends
  // `x-frame-options: DENY` on every response, which is correct and which the tour found.
  //
  // It trashes a SEEDED post and restores it, rather than making one: a new post is not in
  // the already-rendered pane, and refetching the pane from here means a reload, which ends
  // the expression. Restore is the cleanup, and it is also half the assertion.
  flow('admin: the editor can move a piece to the trash', () => expect('/admin/content', `
    (async () => {
      window.confirm = () => true
      const find = (re) => [...document.querySelectorAll('button, a')]
        .find((b) => re.test((b.textContent || '').trim()))
      const wait = async (fn, tries = 60, gap = 100) => {
        for (let i = 0; i < tries; i++) {
          const hit = fn()
          if (hit) return hit
          await new Promise((r) => setTimeout(r, gap))
        }
        return null
      }

      const row = await wait(() => [...document.querySelectorAll('[data-write-row]')]
        .find((a) => /^\\/admin\\/editor\\/[^/]+$/.test(new URL(a.href).pathname)))
      if (!row) return 'the write pane offered no post to open'
      const slug = new URL(row.href).pathname.split('/').pop()
      row.click()

      const attributes = await wait(() => find(/attribut|thuộc tính/i))
      if (!attributes) return 'the editor never showed its Attributes control'
      attributes.click()

      const trash = await wait(() => find(/trash|rác|papierkorb|corbeille|papelera|lixo|cestino|ごみ箱|휴지통|回收站|корзину/i), 40)
      if (!trash) return 'the Attributes panel offers no way to trash the piece'
      trash.click()

      // Gone when the PUBLIC url stops answering — what a reader would check, rather than
      // trusting the button's own optimism.
      const gone = await wait(async () => (await fetch('/' + slug)).status === 404 ? true : null, 60, 200)
      const listed = await (await fetch('/api/admin/view/trash')).json()
        .then((j) => (j?.data?.posts ?? []).some((p) => p.slug === slug))
      // Put it back before reporting either way: a tour that eats a seeded post changes
      // what every later run is testing. SOFT is also what the confirmation promises.
      const back = await fetch('/api/trash', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'posts', action: 'restore', ids: [slug] }),
      })
      if (!gone) return 'the piece still answers after Move to Trash'
      if (!listed) return 'it left the site but never reached the trash'
      return back.ok ? 'ok (' + slug + ')' : 'restore -> ' + back.status
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
      // LAST match, not first: the write pane beside the sheet has a scope tab whose label
      // is "Published" in English, and .find() clicked that — which filters the list and
      // never opens anything. The action bar renders after the pane, so its Publish is the
      // last matching button while the panel is still closed.
      const header = [...document.querySelectorAll('button')].filter((b) => /publish/i.test(b.textContent || '')).pop()
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

  // THE ONE THAT OPENS A REAL POST FULL OF EVERYTHING, in a real browser, and saves it twice.
  //
  // `editor-corpus.test.ts` runs the same shapes under happy-dom and is faster and finer. What
  // it cannot reach is the half of the editor that only exists once React draws — a node view
  // that throws while rendering unmounts the admin, and a DOM shim never mounts React the way a
  // browser does. Both of the blank pages of 2026-08-21 ENDED there, whatever their cause.
  //
  // Two saves is the assertion, not one. A serializer that rewrites the document does it
  // quietly and identically every time, so comparing a save to its source proves nothing about
  // stability; comparing the second save to the first is what catches a post that drifts a
  // little further every time it is opened. Three of the four bugs found this month were
  // exactly that shape.
  flow('admin: a post of every shape opens, and saving it twice changes nothing', () => expect('/admin/editor', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const slug = 'tour-kitchen-' + Date.now()
      const body = ${JSON.stringify(KITCHEN_SINK)}
      const made = await fetch('/api/posts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Tour: bài kiểm tất cả', slug, content: body, status: 'draft', categories: [], tags: [] }),
      })
      if (!made.ok) return 'POST /api/posts -> ' + made.status
      const done = async (verdict) => { await fetch('/api/posts/' + slug, { method: 'DELETE' }); return verdict }
      const stored = async () => (await (await fetch('/api/admin/view/editor?slug=' + slug)).json())?.data?.post?.content ?? ''
      const save = async () => {
        const button = [...document.querySelectorAll('button')].find((b) => /save draft|lưu nháp/i.test(b.textContent || ''))
        if (!button) return 'no Save draft button'
        button.click()
        await sleep(1200)
        return null
      }

      localStorage.clear()
      history.pushState(null, '', '/admin/editor/' + slug)
      dispatchEvent(new PopStateEvent('popstate'))
      await sleep(2000)

      // 1. THE ADMIN IS STILL THERE. This is the white page, asserted directly: a throw during
      //    render leaves #admin empty and every one of these null.
      const root = document.getElementById('admin')
      if (!root || root.innerHTML.length < 500) return done('the admin unmounted while opening the post')
      if (!document.querySelector('nav, aside, .admin-shell')) return done('the shell is gone')
      const surface = document.querySelector('.ProseMirror')
      if (!surface) return done('no writing surface')

      // 2. THE SHAPES BECAME NODES, not text. Each of these was a bug: the mark is the pen, the
      //    table is where three deletions hid, the math span is an atom with no text in it.
      const missing = []
      if (!surface.querySelector('mark')) missing.push('pen stroke')
      if (!surface.querySelector('table')) missing.push('table')
      if (!surface.querySelector('pre')) missing.push('code block')
      if (!surface.querySelector('[data-math], math')) missing.push('formula')
      if (!surface.querySelector('a[href]')) missing.push('link')
      if (!surface.querySelector('[data-type=taskList]')) missing.push('task list')
      if (missing.length) return done('the editor built no ' + missing.join(', '))

      // 3. TWO SAVES CHANGE NOTHING. The first may normalise; the second must not.
      const failedFirst = await save()
      if (failedFirst) return done(failedFirst)
      const first = await stored()
      if (!first) return done('the post had no content after the first save')

      history.pushState(null, '', '/admin/content')
      dispatchEvent(new PopStateEvent('popstate'))
      await sleep(400)
      localStorage.clear()
      history.pushState(null, '', '/admin/editor/' + slug)
      dispatchEvent(new PopStateEvent('popstate'))
      await sleep(2000)
      const failedSecond = await save()
      if (failedSecond) return done(failedSecond)
      const second = await stored()
      if (second !== first) {
        let i = 0
        while (i < first.length && i < second.length && first[i] === second[i]) i++
        return done('the second save rewrote the post at char ' + i + ': ' + JSON.stringify(first.slice(Math.max(0, i - 40), i + 40)) + ' -> ' + JSON.stringify(second.slice(Math.max(0, i - 40), i + 40)))
      }

      // 4. AND NOTHING WAS QUIETLY DROPPED on the way through.
      const gone = []
      if (!first.includes('==')) gone.push('the pen')
      if (!first.includes('\\\\|')) gone.push('the escaped pipe')
      if (!first.includes('$x^2$')) gone.push('the formula in a table cell')
      if (!first.includes('![')) gone.push('the image in a table cell')
      if (first.trimStart().startsWith('- [ ]')) gone.push('(and a checkbox appeared from nowhere)')
      if (gone.length) return done('the round trip lost ' + gone.join(', '))

      return done('ok ' + first.length + ' bytes, unchanged by a second save')
    })()`, 900))

  // The mock's one inserting gesture: "/" on an empty line raises the insert menu, and the
  // character does NOT land in the text. Driven through execCommand so it exercises the same
  // `handleTextInput` path a keyboard reaches. Both halves matter — a menu that opens but
  // also types the slash fails the second assertion.
  flow('admin: "/" on an empty line raises the insert menu', () => expect('/admin/editor', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const surface = document.querySelector('.ProseMirror')
      if (!surface) return 'no writing surface'
      surface.focus()
      document.execCommand('insertText', false, '/')
      await sleep(400)
      const rows = document.querySelectorAll('[data-slash-row]').length
      if (!rows) return 'typing "/" on an empty line raised nothing'
      if (surface.textContent.includes('/')) return 'the menu opened AND the slash landed in the text'
      // Escape closes it and leaves the paragraph as it was.
      surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await sleep(200)
      if (document.querySelector('[data-slash-row]')) return 'Escape did not close the menu'
      return 'ok ' + rows + ' rows'
    })()`, 1200))

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
      // ⚠️ The TOOLBAR has a B again (2026-08-17), so "the button whose text is B" now
      // matches twice and .find() hands back the toolbar's — which the bubble legitimately
      // floats OVER, so this flow went red against a working editor. The bubble's B is the
      // one inside the floating chip, found by its z-40 elevation.
      const boldBtn = [...document.querySelectorAll('button')]
        .filter((b) => b.querySelector('strong') && (b.textContent || '').trim() === 'B')
        .find((b) => b.closest('[class*="z-40"]'))
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
