// THE PICTURE NODE, driven with a pointer.
//
// Its own file rather than a corner of `tour-flows-sheet.ts`, which drives the furniture AROUND
// the paper: these two are about what happens INSIDE the document, on a node that is drawn by a
// ProseMirror node view. Both faults they guard are invisible to a unit test for the same
// reason — a node's attributes, its serializer and its input rules are all reachable without a
// pointer, and neither of these faults touches any of the three.
import type { Tour } from './tour'

export function registerPictureFlows({ flow, atWidth }: Pick<Tour, 'flow' | 'atWidth'>): void {
  /**
   * A GALLERY SAYS HOW MANY COLUMNS THE PAGE WILL USE, and keeps saying it as the run changes.
   *
   * `galleryCols` exists because the editor laid every gallery out three across while the page
   * used two, three or four by count: the commonest gallery of all — four pictures — was 3+1
   * while you wrote it and 2x2 once you published it. The fix stamped the count on each tile,
   * and it was HALF a fix. The count is a property of the RUN, so deleting the fifth photo
   * changes the width of the four that remain — and ProseMirror does not redraw a node whose
   * own attributes did not change. Measured on the React build (2026-09-15): five tiles at
   * three across, delete one, and the four left stayed 204px at three across while the page
   * rendered them 2x2. A decoration recomputes the whole run instead.
   */
  flow('editor: a gallery keeps saying how many columns the page will use', async () => {
    const slug = 'tour-gallery-' + Date.now()
    const made = await atWidth(1700, '/admin/editor', `
    (async () => {
      const lib = await (await fetch('/api/media')).json()
      const items = Array.isArray(lib) ? lib : (lib.data || [])
      const pic = (items.find((i) => i.width) || items[0] || {}).url
      if (!pic) return 'the library had no picture to build a gallery from'
      // A BLANK LINE BETWEEN EACH. Without it five pictures are one paragraph with soft breaks
      // and no build draws a gallery at all, which passes as a test of nothing.
      const tiles = [1, 2, 3, 4, 5].map((n) => '![Tile ' + n + '](' + pic + '#grid)').join('\\n\\n')
      const res = await fetch('/api/posts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Tour: a gallery', slug: '${slug}', status: 'draft', categories: [], tags: [],
          content: 'Before.\\n\\n' + tiles + '\\n\\nAfter.',
        }),
      })
      return res.ok ? 'ok' : 'could not plant a post with a gallery'
    })()`, 900)
    if (made !== 'ok') return made

    return await atWidth(1700, '/admin/editor/' + slug, `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const done = async (verdict) => {
        await fetch('/api/posts/${slug}', { method: 'DELETE' })
        return verdict
      }
      let pm = null
      for (let i = 0; i < 120 && !pm; i++) { pm = document.querySelector('.ProseMirror'); if (!pm) await sleep(50) }
      if (!pm) return done('the editor never opened')
      const tiles = () => [...pm.querySelectorAll('figure.img-grid')]
      for (let i = 0; i < 80 && tiles().length < 5; i++) await sleep(50)
      if (tiles().length !== 5) return done('the gallery drew ' + tiles().length + ' tile(s), not 5')

      const cols = () => tiles().map((t) => t.getAttribute('data-cols')).join(',')
      if (cols() !== '3,3,3,3,3') return done('five tiles said ' + cols() + ' columns, not 3 each')

      // Clicked the way a pointer does: on the drawing, with coordinates. A bare synthetic
      // event on the wrapper is not the same question and passes against a broken build.
      const last = tiles()[4].querySelector('img')
      const box = last.getBoundingClientRect()
      const where = {
        bubbles: true, cancelable: true, button: 0,
        clientX: Math.round(box.left + box.width / 2),
        clientY: Math.round(box.top + box.height / 2),
      }
      for (const kind of ['mousedown', 'mouseup', 'click']) last.dispatchEvent(new MouseEvent(kind, where))
      await sleep(300)
      pm.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Backspace', code: 'Backspace', keyCode: 8, which: 8, bubbles: true, cancelable: true,
      }))
      await sleep(600)

      if (tiles().length !== 4) return done('deleting one tile left ' + tiles().length + ', not 4')
      if (cols() !== '2,2,2,2') return done('four tiles still said ' + cols() + ' columns, but the page draws them 2x2')
      const wide = tiles().map((t) => Math.round(t.getBoundingClientRect().width))
      if (new Set(wide).size !== 1) return done('the four tiles came out ' + wide.join('/') + ' wide')
      if (wide[0] < 260) return done('a tile in a 2x2 measured ' + wide[0] + 'px, which is a three-across width')
      return done('ok 5 tiles at 3 across, one deleted, 4 left at 2 across and ' + wide[0] + 'px')
    })()`, 1400)
  })

  /**
   * A PICTURE'S TOOLBAR OPENS WHEN YOU CLICK IT, and its keys report what is chosen.
   *
   * The same fault the formula flow below guards, on the node that carries seventeen buttons:
   * the toolbar only exists while the node is SELECTED, so a node view that swallows its own
   * pointer events is a picture whose placement can never be changed. And a segmented control
   * whose pressed state is only a background colour is a control a screen reader cannot report,
   * which is why every key carries `aria-pressed`.
   */
  flow('editor: a picture opens its placement keys when you click it', async () => {
    const slug = 'tour-picture-' + Date.now()
    const made = await atWidth(1700, '/admin/editor', `
    (async () => {
      const lib = await (await fetch('/api/media')).json()
      const items = Array.isArray(lib) ? lib : (lib.data || [])
      const pic = (items.find((i) => i.width) || items[0] || {}).url
      if (!pic) return 'the library had no picture'
      const res = await fetch('/api/posts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Tour: a picture', slug: '${slug}', status: 'draft', categories: [], tags: [],
          content: 'Before.\\n\\n![One](' + pic + ')\\n\\n![Two](' + pic + '#grid)\\n\\nAfter.',
        }),
      })
      return res.ok ? 'ok' : 'could not plant a post with a picture'
    })()`, 900)
    if (made !== 'ok') return made

    return await atWidth(1700, '/admin/editor/' + slug, `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const done = async (verdict) => {
        await fetch('/api/posts/${slug}', { method: 'DELETE' })
        return verdict
      }
      let pm = null
      for (let i = 0; i < 120 && !pm; i++) { pm = document.querySelector('.ProseMirror'); if (!pm) await sleep(50) }
      if (!pm) return done('the editor never opened')
      const figs = () => [...pm.querySelectorAll('figure')]
      for (let i = 0; i < 80 && figs().length < 2; i++) await sleep(50)
      if (figs().length !== 2) return done('the post drew ' + figs().length + ' picture(s), not 2')
      // A toolbar that is drawn but hidden and a toolbar that is not drawn are the same thing
      // on the glass, and the build has used both. Either counts as shut.
      const shut = (f) => { const d = f.querySelector('div'); return !d || d.hidden }
      const keys = (f) => [...f.querySelectorAll('button')]
      const tap = (el) => {
        const b = el.getBoundingClientRect()
        const where = {
          bubbles: true, cancelable: true, button: 0,
          clientX: Math.round(b.left + b.width / 2), clientY: Math.round(b.top + b.height / 2),
        }
        for (const kind of ['mousedown', 'mouseup', 'click']) el.dispatchEvent(new MouseEvent(kind, where))
      }

      // The sheet opens with the leading picture already chosen, so move off it first: a test
      // that clicks a thing already chosen proves nothing about clicking.
      tap(figs()[1].querySelector('img'))
      await sleep(400)
      if (!shut(figs()[0])) return done('choosing the second picture left the first one holding its keys')
      tap(figs()[0].querySelector('img'))
      await sleep(400)
      if (shut(figs()[0])) return done('clicking a picture did not open its placement keys')
      if (!shut(figs()[1])) return done('two pictures held their keys open at once')

      const open = keys(figs()[0])
      if (open.length < 12) return done('the toolbar drew ' + open.length + ' key(s), fewer than the twelve a lone picture has')
      const mute = open.filter((b) => !b.hasAttribute('aria-pressed'))
      if (mute.length) return done(mute.length + ' key(s) say nothing about being chosen: ' + mute.map((b) => b.textContent).join(', '))
      const on = open.filter((b) => b.getAttribute('aria-pressed') === 'true')
      if (!on.length) return done('no key reported itself as the chosen one')
      return done('ok ' + open.length + ' keys, ' + on.length + ' reported chosen (' + on.map((b) => b.textContent).join(', ') + ')')
    })()`, 1400)
  })

  // THE KEYBOARD OPENS A PICTURE, and closing gives it back. Until 2026-09-23 the viewer had
  // only a pointer's way in: the pictures were not focusable, so for anyone on Tab the arrows and
  // captions inside it did not exist.
  flow('a picture in a post opens from the keyboard, and closing hands focus back', () => atWidth(
    1440, '/the-reed-pen-in-van-goghs-letters', `(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const img = document.querySelector('.prose figure img')
      if (!img) return 'the post has no picture to open'
      if (img.tabIndex !== 0) return 'the picture is not a Tab stop (tabIndex ' + img.tabIndex + ')'
      if (img.getAttribute('aria-haspopup') !== 'dialog') return 'the picture does not say it opens a dialog'
      img.focus()
      img.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
      await sleep(150)
      const box = document.querySelector('dialog.lightbox[open]')
      if (!box) return 'Enter on a focused picture opened nothing'
      if (!box.contains(document.activeElement)) return 'the viewer opened without focus in it'
      box.close()
      await sleep(150)
      if (document.activeElement !== img) return 'closing left focus on ' + (document.activeElement?.tagName ?? 'nothing')
      img.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }))
      await sleep(150)
      const again = document.querySelector('dialog.lightbox[open]')
      if (!again) return 'Space did not open it'
      again.close()
      return 'ok'
    })()`))
}
