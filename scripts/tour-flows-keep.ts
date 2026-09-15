// KEEPING THE WRITER'S WORK, and keeping the list beside it true.
//
// Three promises this screen makes that only a browser can check. The first is the one that
// matters most: a snapshot on this device is OFFERED BACK, and pressing Restore puts the words
// in. Everything about that is decided at runtime — storage, a timestamp compared with the
// row's, a strip drawn and hidden, a whole draft pushed back through eleven fields — and none
// of it is reachable from a unit test.
//
// ⚠️ NO BACKTICKS AND NO REGEX LITERALS inside these expressions. Each one is a template
// literal: a backtick in a comment closes it, and a backslash is eaten before the browser sees
// it, so an escaped slash arrives unterminated and the flow dies with a bare "Uncaught".
import type { Tour } from './tour'

export function registerKeepFlows({ flow, atWidth }: Pick<Tour, 'flow' | 'atWidth'>): void {
  /**
   * A DRAFT KEPT ON THIS DEVICE IS OFFERED BACK, and taking it puts the words in.
   *
   * The editor writes a copy nobody asked for, on a tick and on the way out, and offers it on
   * the way back in. What this drives is the whole chain: the snapshot is read at boot, its
   * timestamp is compared with the row's last real save, the strip under the action line is
   * shown, and Restore pushes a whole draft back through the fields and the paper — keeping the
   * live slug, which is the one thing a snapshot may not bring with it.
   */
  flow('editor: work kept on this device is offered back, and Restore puts it in', async () => {
    const slug = 'tour-kept-' + Date.now()
    const planted = await atWidth(1700, '/admin/content', `
    (async () => {
      const res = await fetch('/api/posts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Tour: kept work', slug: '${slug}', status: 'draft', categories: [], tags: [],
          content: 'The saved paragraph.',
        }),
      })
      if (!res.ok) return 'could not plant a post'
      // The copy a crash would have left behind: NEWER than the save above, and carrying both
      // a different body and a different slug — the slug is what must NOT come back.
      localStorage.setItem('quire:draft:post:${slug}', JSON.stringify({
        at: new Date(Date.now() + 1000).toISOString(),
        data: {
          title: 'Tour: kept work', slug: 'a-slug-from-before-a-rename', date: '',
          status: 'draft', categories: [], tags: [], series: '', seriesOrder: 0,
          featuredImage: '', coverImage: '', metaTitle: '', metaDescription: '', excerpt: '',
          sourceUrl: '', sourceTitle: '', quote: '',
          content: 'The paragraph that was never saved.',
        },
      }))
      return 'ok'
    })()`, 900)
    if (planted !== 'ok') return planted

    return await atWidth(1700, '/admin/editor/' + slug, `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const done = async (verdict) => {
        localStorage.removeItem('quire:draft:post:${slug}')
        await fetch('/api/posts/${slug}', { method: 'DELETE' })
        return verdict
      }
      const wait = async (get, tries) => {
        for (let i = 0; i < tries; i++) { const v = get(); if (v) return v; await sleep(50) }
        return null
      }
      if (!(await wait(() => document.querySelector('.ProseMirror'), 140))) {
        return done('the editor never opened')
      }
      const seen = (el) => el && el.offsetParent !== null

      const strip = await wait(() => {
        const el = document.querySelector('[data-sheet-found]')
        return el && seen(el) ? el : null
      }, 60)
      if (!strip) return done('a draft was kept on this device and nothing offered it back')

      const restore = document.querySelector('[data-sheet-restore]')
      if (!restore) return done('the offer has no way to take it')
      restore.click()
      await sleep(900)

      const paper = document.querySelector('.ProseMirror')
      if (paper.innerText.indexOf('never saved') < 0) {
        return done('Restore did not put the kept words in: ' + paper.innerText.slice(0, 60))
      }
      // ⚠️ THE SLUG STAYS. A snapshot taken before a rename carries the old address; restoring
      // it whole would rename a published post as the price of getting a paragraph back.
      const slugBox = document.querySelector('[data-k="slug"]')
      if (!slugBox || slugBox.value !== '${slug}') {
        return done('the restore moved the address to ' + (slugBox ? slugBox.value : 'nothing'))
      }
      if (seen(document.querySelector('[data-sheet-found]'))) {
        return done('the offer was taken and stayed on screen')
      }
      return done('ok restored, and the address is still ${slug}')
    })()`, 1700)
  })

  /**
   * THE COPY THAT IS NOT ON THIS DEVICE.
   *
   * The device snapshot survives a crash and a closed tab; it cannot survive the laptop. The
   * server's copy is the one that answers the case the other cannot — a different machine — and
   * it is the one with a round trip in it: the editor is handed only WHEN it was taken, and the
   * body is fetched only if somebody says yes. Nothing else drives that fetch.
   */
  flow('editor: a draft kept on the server is offered back, and fetched only when taken', async () => {
    const slug = 'tour-server-kept-' + Date.now()
    const planted = await atWidth(1700, '/admin/content', `
    (async () => {
      const res = await fetch('/api/posts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Tour: server kept', slug: '${slug}', status: 'draft', categories: [], tags: [],
          content: 'The saved paragraph.',
        }),
      })
      if (!res.ok) return 'could not plant a post'
      // Nothing on this device, so the offer can only be the server's.
      try { localStorage.removeItem('quire:draft:post:${slug}') } catch (e) { /* private window */ }
      const kept = await fetch('/api/posts/${slug}/autosave', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          snapshot: JSON.stringify({
            title: 'Tour: server kept', slug: '${slug}', date: '', status: 'draft',
            categories: [], tags: [], series: '', seriesOrder: 0, featuredImage: '',
            coverImage: '', metaTitle: '', metaDescription: '', excerpt: '',
            sourceUrl: '', sourceTitle: '', quote: '',
            content: 'A paragraph typed on another machine.',
          }),
        }),
      })
      return kept.ok ? 'ok' : 'the server refused the snapshot: ' + kept.status
    })()`, 900)
    if (planted !== 'ok') return planted

    return await atWidth(1700, '/admin/editor/' + slug, `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const done = async (verdict) => {
        await fetch('/api/posts/${slug}', { method: 'DELETE' })
        return verdict
      }
      const wait = async (get, tries) => {
        for (let i = 0; i < tries; i++) { const v = get(); if (v) return v; await sleep(50) }
        return null
      }
      if (!(await wait(() => document.querySelector('.ProseMirror'), 140))) {
        return done('the editor never opened')
      }
      const strip = await wait(() => {
        const el = document.querySelector('[data-sheet-found]')
        return el && !el.hidden ? el : null
      }, 60)
      if (!strip) return done('a draft was kept on the server and nothing offered it back')
      // ⚠️ THE BODY WAS NOT FETCHED YET. The offer is made from a timestamp; paying for the
      // whole body a second time on every editor open, to answer a question a timestamp
      // already answers, is a real cost on a long piece.
      if (document.querySelector('.ProseMirror').innerText.indexOf('another machine') >= 0) {
        return done('the server copy was already in the paper before anybody asked for it')
      }
      document.querySelector('[data-sheet-restore]').click()
      await sleep(1200)
      const paper = document.querySelector('.ProseMirror')
      if (paper.innerText.indexOf('another machine') < 0) {
        return done('Restore did not fetch the server copy: ' + paper.innerText.slice(0, 60))
      }
      return done('ok offered from a timestamp, fetched on Restore')
    })()`, 1700)
  })

  /**
   * THE TIME MACHINE: the versions a save left behind.
   *
   * Its frame is in the markup; the ROWS are fetched and built, because they change with every
   * save. A post's alone — pages and notes keep no revisions.
   */
  flow('editor: the time machine lists what a save overwrote, and puts one back', async () => {
    const slug = 'tour-past-' + Date.now()
    const planted = await atWidth(1700, '/admin/content', `
    (async () => {
      const make = (content) => fetch('/api/posts' + (content === 'first' ? '' : '/${slug}'), {
        method: content === 'first' ? 'POST' : 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Tour: a past', slug: '${slug}', status: 'draft', categories: [], tags: [],
          content: content === 'first' ? 'The version that was overwritten.' : 'The version on screen.',
        }),
      })
      // TWO saves, because a revision is what the SECOND one displaced.
      if (!(await make('first')).ok) return 'could not plant a post'
      if (!(await make('second')).ok) return 'could not overwrite it'
      return 'ok'
    })()`, 900)
    if (planted !== 'ok') return planted

    return await atWidth(1700, '/admin/editor/' + slug, `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const done = async (verdict) => {
        await fetch('/api/posts/${slug}', { method: 'DELETE' })
        return verdict
      }
      const wait = async (get, tries) => {
        for (let i = 0; i < tries; i++) { const v = get(); if (v) return v; await sleep(60) }
        return null
      }
      if (!(await wait(() => document.querySelector('.ProseMirror'), 140))) {
        return done('the editor never opened')
      }
      const attrs = [...document.querySelectorAll('[data-sheet-attrs]')]
        .find((el) => el.offsetParent !== null)
      if (!attrs) return done('no key for the attributes panel')
      attrs.click()
      await sleep(500)

      const past = document.querySelector('[data-sheet-history]')
      if (!past || past.hidden) return done('a saved post offers no way to its past')
      past.click()
      const row = await wait(() => document.querySelector('[data-history-list] li'), 60)
      if (!row) return done('the time machine listed nothing for a post that was overwritten')

      const restore = row.querySelector('button')
      if (!restore) return done('a listed version has no way to take it')
      restore.click()
      await sleep(1000)
      const paper = document.querySelector('.ProseMirror')
      if (paper.innerText.indexOf('was overwritten') < 0) {
        return done('the version did not come back: ' + paper.innerText.slice(0, 60))
      }
      if (!document.querySelector('[data-history]').hidden) {
        return done('the dialog stayed open over the version it had just restored')
      }
      return done('ok listed and restored')
    })()`, 1700)
  })

  /**
   * THE FIRST PUBLISH OPENS THE ATTRIBUTES INSTEAD OF PUBLISHING (ADR 0024, step 5).
   *
   * They are the publish-time questions — the slug, the date, the terms, both pictures — and
   * they all already carry an answer, so this is a look rather than a form. The second press,
   * from inside the panel, is the one that publishes.
   */
  flow('editor: the first Publish asks the publish-time questions', async () => {
    const slug = 'tour-publish-' + Date.now()
    const planted = await atWidth(1700, '/admin/content', `
    (async () => {
      const res = await fetch('/api/posts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Tour: a first publish', slug: '${slug}', status: 'draft',
          categories: [], tags: [], content: 'Ready to go out.',
        }),
      })
      return res.ok ? 'ok' : 'could not plant a post'
    })()`, 900)
    if (planted !== 'ok') return planted

    return await atWidth(1700, '/admin/editor/' + slug, `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const done = async (verdict) => {
        await fetch('/api/posts/${slug}', { method: 'DELETE' })
        return verdict
      }
      const wait = async (get, tries) => {
        for (let i = 0; i < tries; i++) { const v = get(); if (v) return v; await sleep(50) }
        return null
      }
      if (!(await wait(() => document.querySelector('.ProseMirror'), 140))) {
        return done('the editor never opened')
      }
      const seen = (el) => el && el.offsetParent !== null
      const panel = document.querySelector('[data-sheet-panel]')
      if (!panel) return done('the sheet has no attributes panel')
      // ⚠️ THE hidden ATTRIBUTE, NOT offsetParent. The panel is fixed-position, and a fixed
      // element has no offsetParent whether it is on screen or not — so the usual visibility
      // test reads an OPEN panel as shut, and this flow reported a Publish that asked nothing
      // when it had asked properly. (No backticks: this is a template literal.)
      if (!panel.hidden) return done('the attributes were open before anybody asked')

      const publish = document.querySelector('[data-sheet-publish]')
      if (!publish) return done('no Publish key')
      publish.click()
      await sleep(700)
      if (panel.hidden) return done('the first Publish published without asking anything')

      const asked = await (await fetch('/api/posts/${slug}', { headers: { accept: 'application/json' } })).json()
      const state = (asked && asked.data ? asked.data : asked).status
      if (state !== 'draft') return done('the first Publish published it anyway: ' + state)

      const key = document.querySelector('[data-panel-publish]')
      if (!key || key.hidden) return done('the panel is asking and has no key to answer with')
      key.click()
      await sleep(1800)

      const after = await (await fetch('/api/posts/${slug}', { headers: { accept: 'application/json' } })).json()
      const now = (after && after.data ? after.data : after).status
      if (now !== 'published') return done('the second press did not publish it: ' + now)
      return done('ok asked first, published second')
    })()`, 1700)
  })

  /**
   * A RENAME MOVES THE ADDRESS AND THE ROW BESIDE IT, WITHOUT A RELOAD.
   *
   * The address is synced with `history.replaceState` and the page is deliberately NOT reloaded:
   * a reload would cost the caret, the selection and the whole undo stack on the click that
   * saved the work. The column beside the sheet is server-drawn markup, so it is fetched and
   * swapped instead — and the row has to come back under its new name, still marked as the one
   * being edited.
   */
  flow('editor: a rename moves the address and the row beside it, with no reload', async () => {
    const slug = 'tour-rename-' + Date.now()
    const planted = await atWidth(1700, '/admin/content', `
    (async () => {
      const res = await fetch('/api/posts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Tour: a rename', slug: '${slug}', status: 'draft',
          categories: [], tags: [], content: 'Before the rename.',
        }),
      })
      return res.ok ? 'ok' : 'could not plant a post'
    })()`, 900)
    if (planted !== 'ok') return planted

    return await atWidth(1700, '/admin/editor/' + slug, `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const next = '${slug}-moved'
      const done = async (verdict) => {
        await fetch('/api/posts/${slug}', { method: 'DELETE' })
        await fetch('/api/posts/' + next, { method: 'DELETE' })
        return verdict
      }
      const wait = async (get, tries) => {
        for (let i = 0; i < tries; i++) { const v = get(); if (v) return v; await sleep(50) }
        return null
      }
      if (!(await wait(() => document.querySelector('.ProseMirror'), 140))) {
        return done('the editor never opened')
      }
      // A stamp on the editor, so a page that RELOADED can be told from one that did not.
      window.__tourStamp = 'here'

      // The VISIBLE one: two of each ship, and at this width the first in the markup is the
      // phone menu's, folded away inside a details element.
      const attrs = [...document.querySelectorAll('[data-sheet-attrs]')]
        .find((el) => el.offsetParent !== null)
      if (!attrs) return done('no key for the attributes panel')
      attrs.click()
      await sleep(600)
      const slugBox = document.querySelector('[data-k="slug"]')
      if (!slugBox) return done('the panel has no slug field')
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(slugBox), 'value').set
      setter.call(slugBox, next)
      slugBox.dispatchEvent(new Event('input', { bubbles: true }))
      await sleep(200)

      const save = document.querySelector('[data-sheet-save]')
      if (!save) return done('no key to save with')
      save.click()
      await sleep(2500)

      if (window.__tourStamp !== 'here') return done('the sheet reloaded itself over the save')
      if (location.pathname.indexOf(next) < 0) {
        return done('the address did not follow the rename: ' + location.pathname)
      }
      const row = await wait(() => document.querySelector('[data-piece="post:' + next + '"]'), 80)
      if (!row) return done('the column beside the sheet never learned the new name')
      if (row.getAttribute('aria-current') !== 'page') {
        return done('the renamed row came back unselected')
      }
      return done('ok address and row both followed, with no reload')
    })()`, 1700)
  })
}
