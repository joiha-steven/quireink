// The net under the admin: that it exists, that it is in the right place, and that it speaks.
//
// It is NOT rendered here, and `ErrorBoundary.tsx` says why: admin JSX compiles to hono's
// runtime under the root tsconfig that `bun test` uses, so React refuses the elements. What
// that leaves is worth having anyway, because the failure this guards is not "the sheet
// renders wrong" — it is somebody deleting the boundary, or moving it up one level during a
// refactor so it wraps the sidebar too and a dead page takes the navigation with it.
//
// The sheet itself was tripped on purpose in a real browser and looked at, which is the same
// standard `docs/` sets for anything that has to be SEEN.

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { ErrorBoundary } from '@/admin/ui/ErrorBoundary'
import en from '@/locales/admin/en'
import vi from '@/locales/admin/vi'
import de from '@/locales/admin/de'
import ja from '@/locales/admin/ja'
import zh from '@/locales/admin/zh'
import ko from '@/locales/admin/ko'

const APP = readFileSync('src/admin/App.tsx', 'utf8')

describe('the admin error boundary', () => {
  it('turns a thrown value into state instead of letting it through', async () => {
    // The one line React calls, called directly. `getDerivedStateFromError` returning the
    // error is the whole difference between a fallback and an unmounted tree.
    const thrown = new Error('token.type is undefined')
    expect(ErrorBoundary.getDerivedStateFromError(thrown)).toEqual({ error: thrown })
    // Anything can be thrown, not only an Error, and a boundary that only handles one shape
    // re-throws the other one.
    expect(ErrorBoundary.getDerivedStateFromError('a string')).toEqual({ error: 'a string' })
  })

  it('is mounted around the route and keyed by the visit, not only the path', async () => {
    // Keyed, so leaving the broken page resets it without a reload — a boundary that stays
    // tripped after you have navigated away is a second way to be stuck.
    //
    // The nav count is the other half, and it is load-bearing beyond the boundary: the editor
    // moves the address itself after a first save, so a later click on New post pushes the
    // path the router still believes it is on. On the path alone nothing remounted and the
    // blank sheet came up holding the piece just saved.
    expect(APP).toContain('<ErrorBoundary key={`${path}#${nav}`}>')
  })

  it('cannot take the rail down with it, because the rail is not in this tree', async () => {
    // The placement IS the feature: the rail keeps working, so a screen that dies is a screen
    // you can leave. It used to be an ORDERING inside this file — the sidebar had to be
    // rendered before the boundary — and since ADR 0054 it is structural: the rail is HTML the
    // server writes, outside `#admin` entirely, so no React error can unmount it.
    //
    // Asserted on the shell rather than on App.tsx, because that is where the fact now lives.
    const shell = readFileSync('src/web/admin/spa.ts', 'utf8')
    const rail = shell.indexOf('${railHtml(')
    const mount = shell.indexOf('<div id="admin"></div>')
    expect(rail).toBeGreaterThan(-1)
    expect(rail).toBeLessThan(mount)
    // And React still mounts into a div that is INSIDE the canvas, so a page that throws is
    // replaced in its own frame rather than taking the frame with it.
    expect(shell.indexOf('id="admin-content"')).toBeLessThan(mount)
  })

  it('speaks all six languages', async () => {
    // The i18n rule is that a string exists in every locale; `satisfies AdminStrings` already
    // makes a MISSING key a type error, so what is checked here is the other failure — a key
    // added to five files and left as English in the sixth, or left empty.
    for (const [lang, t] of [['en', en], ['vi', vi], ['de', de], ['ja', ja], ['zh', zh], ['ko', ko]] as const) {
      for (const key of ['crashTitle', 'crashText', 'crashDetail', 'crashReload', 'crashHome'] as const) {
        expect(t[key].length, `${lang}.${key}`).toBeGreaterThan(0)
        if (lang !== 'en') expect(t[key], `${lang}.${key}`).not.toBe(en[key])
      }
    }
  })

  it('offers a way out, and does not offer a retry that cannot work', async () => {
    // React does not re-run a failed render on its own, so a "try again" button would be a
    // control that does nothing twice. Reload and leave are the two honest offers.
    const source = readFileSync('src/admin/ui/ErrorBoundary.tsx', 'utf8')
    expect(source).toContain('location.reload()')
    expect(source).toContain("location.href = '/admin'")
  })
})
