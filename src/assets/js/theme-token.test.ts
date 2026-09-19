// THE WORD ON THE THEME KEY, which names what pressing it gives you.
//
// It was drawn once by the server and never moved: a reader in the dark was offered "dark",
// which is the one thing they could already see. The glyph beside it had always been repainted
// — a moon while the page is dark — so only half the button knew where it was.
//
// ⚠️ THE TWO HALVES DISAGREE ON PURPOSE AND NEVER MEET. The glyph shows the CURRENT sky; the
// word shows the OPPOSITE, because it reads as a label on an action. `.btn-token` is
// `display:none` until the IDE chrome is on, and that chrome hides the icon, so no reader ever
// sees both at once. Asserted here so the next person to "fix" one of them finds out.
import { beforeEach, describe, expect, it } from 'bun:test'
import { theme } from './theme'
import { page, useDom } from './test-dom'

useDom()

const WORDS = 'dark|light'
const button = () => document.querySelector<HTMLButtonElement>('[data-theme-toggle]')!
const word = () => button().querySelector('.btn-token')?.textContent
const glyph = () => button().querySelector('svg')?.innerHTML ?? ''
const scheme = () => document.documentElement.dataset.scheme

/** The header key as `web/chrome.ts` renders it: the dark word, because a fresh page is light. */
function withKey(words = WORDS): void {
  page(
    `<button data-theme-toggle data-theme-words="${words}" aria-haspopup="true"`
    + ` aria-expanded="false"><svg><circle cx="12" cy="12" r="4"/></svg>`
    + `<span class="btn-token">dark</span></button>`,
    { theme: 'Theme', themeLight: 'Light', themeDark: 'Dark', themeSystem: 'System', themeTime: 'By time' },
  )
  document.documentElement.removeAttribute('data-scheme')
  document.documentElement.classList.remove('dark')
}

const choose = (mode: string): void => {
  const row = [...document.querySelectorAll<HTMLButtonElement>('.theme-menu button')]
    .find((b) => (b.textContent ?? '').trim().toLowerCase() === mode)
  row!.click()
}

beforeEach(() => {
  try { localStorage.removeItem('theme') } catch { /* ignore */ }
})

describe('the word on the theme key', () => {
  it('offers dark while the page is light', () => {
    withKey()
    theme()
    expect(scheme()).toBe('light')
    expect(word()).toBe('dark')
  })

  it('offers light the moment the page goes dark', () => {
    withKey()
    theme()
    choose('dark')
    expect(scheme()).toBe('dark')
    expect(word()).toBe('light')
  })

  it('goes back to offering dark when the reader picks light again', () => {
    withKey()
    theme()
    choose('dark')
    choose('light')
    expect(scheme()).toBe('light')
    expect(word()).toBe('dark')
  })

  it('follows what is on SCREEN, not the name of the mode', () => {
    // ⚠️ THE WHOLE POINT. Under "system" and "by time" the mode is neither light nor dark, and
    // the word still has to answer for what the reader is looking at. A stored mode of `dark`
    // reaching the page as dark is the same assertion as above; this one starts from a mode
    // whose name says nothing.
    withKey()
    theme()
    choose('by time')
    const dark = scheme() === 'dark'
    expect(word()).toBe(dark ? 'light' : 'dark')
  })

  it('repaints the glyph to the CURRENT sky, which is the other way round', () => {
    withKey()
    theme()
    const inLight = glyph()
    choose('dark')
    expect(glyph()).not.toBe(inLight)
    // A moon is one path; the sun this fixture ships is a circle. The assertion is that the
    // two halves moved in OPPOSITE directions on the same event.
    expect(glyph()).toContain('<path')
    expect(word()).toBe('light')
  })

  it('leaves the word alone when the server sent no pair', () => {
    // An older cached page, or a look that never draws the token. Nothing may throw, and the
    // word must not become 'undefined'.
    withKey('')
    theme()
    expect(word()).toBe('dark')
    choose('dark')
    expect(word()).toBe('dark')
    expect(scheme()).toBe('dark')
  })
})
