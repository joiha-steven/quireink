// `hidden` must actually hide, on the classes that set a display value.
//
// The grid toggle sets `button.hidden = true` on any page with no list. The attribute's own
// rule is a UA default, so `.icon-btn{display:flex}` outranked it and the button stayed on
// screen — on every article, every /search and every 404 — announcing aria-pressed="false"
// for a list that was not there. Found on the live demo, not in a test, which is why this
// exists: it was already fixed once for one component (`.theme-menu[hidden]`) and came back
// on the next class that set a display.
import { describe, expect, test } from 'bun:test'
import { PUBLIC_CSS } from '@/web/public.css'

describe('the hidden attribute', () => {
  test('is enforced globally, not per component', () => {
    expect(PUBLIC_CSS).toContain('[hidden]{display:none!important}')
  })

  /**
   * Every class that sets a display value is a class that can outrank `hidden`. This does not
   * ask them to stop; it asks that the general rule stays in the sheet with them.
   */
  test('outranks the display values the sheet sets', () => {
    const setsDisplay = [...PUBLIC_CSS.matchAll(/\.([a-z-]+)\{[^}]*display:(flex|block|grid|inline-flex)/g)]
    expect(setsDisplay.length).toBeGreaterThan(3)
    expect(PUBLIC_CSS.indexOf('[hidden]{display:none!important}')).toBeGreaterThan(-1)
  })
})
