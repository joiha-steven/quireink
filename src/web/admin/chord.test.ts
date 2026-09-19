// A KEYBOARD CHORD IS TWO SPELLINGS, AND THE STYLESHEET PICKS BETWEEN THEM.
//
// The server has no platform to ask, so it prints both. Until 2026-09-19 the picking was a
// `textContent` swap the boot script ran on `DOMContentLoaded` — one beat AFTER the first paint
// — so every admin page opened printing `Ctrl+Shift+K` and then narrowed to `⌘⇧K`. The search
// key shares its row with the wordmark, the wordmark's box is `min-w-0 truncate`, and the wider
// Windows chord squeezed the logo; the swap let it spring back. Filmed on a navigation between
// two admin screens: the logo jumps size on every load, which is what "the logo flickers when
// you click to another page" was.
//
// `rail.ts`'s own header states the rule this broke — "a rail rendered in one state and
// corrected afterwards is a rail that visibly moves on every single load" — so the fix is the
// arrangement already used for the search control's two shapes and the wordmark's two sizes:
// both in the markup, `data-mac` on `<html>` before the paint, and CSS decides.

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { chordBadge, chordSpellings } from '@/web/admin/rail-rows'
import { railBootScript } from '@/web/admin/rail'

const SHEET = readFileSync('src/admin/admin.css', 'utf8')

describe('both spellings reach the browser', () => {
  test('a chord is written twice, in two spans a rule can tell apart', () => {
    const html = chordSpellings('Mod-Shift-k')
    expect(html).toContain('class="chord-other">Ctrl+Shift+K<')
    expect(html).toContain('class="chord-mac">⌘⇧K<')
  })

  test('the badge on the search key carries both, and names neither in an attribute', () => {
    const html = chordBadge()
    expect(html).toContain('chord-other')
    expect(html).toContain('chord-mac')
    // `data-mac` on the element was the old arrangement: a value for a script to read back.
    expect(html).not.toContain('data-mac=')
  })
})

describe('the picking happens before the first paint', () => {
  test('the boot script still says which platform this is', () => {
    expect(railBootScript()).toContain("setAttribute('data-mac','1')")
  })

  test('and touches no element after it', () => {
    // The whole bug in one assertion: a boot script that waits for the DOM is a boot script
    // running after the paint it exists to beat.
    const boot = railBootScript()
    expect(boot).not.toContain('DOMContentLoaded')
    expect(boot).not.toContain('textContent')
    expect(boot).not.toContain('querySelectorAll')
  })

  test('the stylesheet is what hides the spelling this platform does not use', () => {
    expect(SHEET).toContain('.chord-mac { display: none; }')
    expect(SHEET).toContain(":root[data-mac='1'] .chord-mac")
    expect(SHEET).toContain(":root[data-mac='1'] .chord-other")
  })
})
