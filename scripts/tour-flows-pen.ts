// The one thing about the admin's stylesheet that only a browser can answer: does a stroke
// drawn on the writing surface actually have ink in it.
//
// WHY THIS EXISTS AS ITS OWN FLOW. `build-admin.ts` appends the WHOLE pen — `INK_CSS`, 523 KB
// of it after minification, 78% of the admin's 671 KB sheet — to every admin screen, because
// a stroke you cannot see while you are writing is a stroke you cannot place. The reader's
// side stopped doing that in ADR 0027: there the ink is two standalone hashed files, linked
// only when a page's HTML contains a mark. Doing the same for the admin is the obvious saving
// and it has not been done, and the reason it has not is this: NOTHING WOULD HAVE CAUGHT IT
// BREAKING. `check:admin-css` asks whether every class in the markup has a rule, which is the
// wrong question — it reads the built sheet, so a sheet the page never LINKS still satisfies
// it. The tour, which is the gate for "only a browser found it", had no flow that looked at a
// stroke at all.
//
// So this is written first and on purpose, ahead of any split: the guard comes before the
// change it guards, because the failure it is guarding against is invisible from the outside.
// A highlight with no ink is not an error, not a blank space and not a layout shift — it is
// text that looks like ordinary text, on a screen only the owner ever opens.
//
// ⚠️ IT DOES NOT TYPE `==x==`. That would prove the input rule in `editor/input-rules.ts` and
// the stylesheet together, and when it went red there would be two places to look. A `<mark>`
// put into the surface by hand asks the one question this file is about: given a mark on the
// writing surface, does the sheet in front of the owner paint it.
import type { Tour } from './tour'

// ⚠️ ALL THREE WRITING ADDRESSES, since the split of 2026-09-23 made the pen a sheet a screen has
// to ask for: a page or a note whose screen forgot to ask would write in invisible ink.
const WRITING = ['/admin/editor', '/admin/page-editor', '/admin/note-editor']

export function registerPenFlows({ flow, expect }: Pick<Tour, 'flow' | 'expect'>): void {
  for (const path of WRITING) flow(`admin: a stroke on the writing surface has ink in it (${path})`, () => expect(path, `
    (() => {
      // The rules are written '.prose mark', so the container is the assertion's other half:
      // a mark outside one is correctly unpainted, and reporting THAT as a failure would send
      // whoever reads it to the stylesheet instead of to the markup.
      const surface = document.querySelector('.prose') ?? document.querySelector('.ProseMirror')
      if (!surface) return 'no writing surface on the editor screen'
      const where = surface.className || surface.tagName
      const probe = document.createElement('mark')
      // A die other than the default: the bare-'mark' rule and the dealt 'data-pen' rules are
      // built by different functions in ink.css.ts, and a split could drop either one.
      probe.setAttribute('data-pen', '7')
      probe.textContent = 'tour'
      surface.appendChild(probe)
      const paint = getComputedStyle(probe).backgroundImage
      const stroke = getComputedStyle(probe).getPropertyValue('--ink-stroke')
      probe.remove()
      if (!stroke.trim()) return 'the mark has no --ink-stroke, so the pen sheet is not in front of the editor (' + where + ')'
      if (!paint || paint === 'none') return 'the mark resolves --ink-stroke but paints nothing (' + where + ')'
      return 'ok a mark in .' + where + ' paints ' + paint.slice(0, 28) + '…'
    })()`, 1200))

  // AND THE OTHER HALF OF THE SPLIT: a screen with no paper does not pay for the pen. Asked of
  // the LINKS rather than of a computed style, because the failure is bytes, not paint — the
  // dashboard would look exactly the same carrying 523 KB it has no use for.
  flow('admin: a screen with no writing sheet does not load the pen', () => expect('/admin', `
    (() => {
      const pen = [...document.querySelectorAll('link[rel=stylesheet]')].filter((l) => /admin-ink\\./.test(l.href))
      if (pen.length) return 'the dashboard links the pen: ' + pen[0].href
      if (document.querySelector('.prose')) return 'the dashboard draws a .prose, so it may need the pen after all'
      return 'ok'
    })()`))
}
