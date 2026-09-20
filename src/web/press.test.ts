// EVERY CONTROL THAT ANSWERS A POINTER ALSO ANSWERS A FINGER, or is written down as not.
//
// `motion.css.ts` states the rule in one line — "the click, for everything a finger can
// press" — and then enumerates the controls by hand underneath it. Nothing compared the two.
// Measured on 2026-09-20: five boxes had a hover and no press at all (the overlay's close
// key, the phone's book key, the quote's copy pill, the book toolbar's size keys, the pen
// bar's keys), one press was painted in ink nobody could see, and one carve landed on a
// button with no box.
//
// So the two lists live here instead, and a control with a `:hover` rule that is in neither
// fails this file until somebody decides which it is. Adding a name to PRESSES is a line;
// adding one to NO_PRESS costs a reason, which is the asymmetry that keeps the rule honest.
import { describe, expect, it } from 'bun:test'
import { PUBLIC_CSS } from '@/web/public.css'

/** Selector text with comments gone, so a class named in prose is never mistaken for a rule. */
const SHEET = PUBLIC_CSS.replace(/\/\*[\s\S]*?\*\//g, '')
const RULES = [...SHEET.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
  sel: m[1]!.replace(/\s+/g, ' ').trim(),
  body: m[2]!.replace(/\s+/g, ' ').trim(),
}))

/**
 * The CONTROL a pseudo-class is attached to, as the selector spells it.
 *
 * ⚠️ NOT "every class in the selector", which was the first cut and wrong twice over: it read
 * `.pen-bar button:not(.pen-swatch):active` as a press for the bar AND for the swatch the
 * `:not()` exists to exclude, and it read `.theme-menu button:active` as a press for the menu
 * box rather than for the button in it. The string before the pseudo-class IS the control.
 */
const controls = (rule: { sel: string }, state: string): string[] =>
  rule.sel.split(',')
    .filter((part) => part.includes(state))
    .map((part) => part.split(state)[0]!.replace(/:not\([^)]*\)/g, '').replace(/\s+/g, ' ').trim())
    .filter((key) => key !== '')

const hovering = new Set<string>()
for (const r of RULES) for (const c of controls(r, ':hover')) hovering.add(c)

/** The press, however it is spelt — and never the rules that TAKE one away. */
const pressing = new Set<string>()
for (const r of RULES) {
  if (!/transform|box-shadow|color/.test(r.body)) continue
  // ⚠️ EXACT, not startsWith. The resume pill's real press begins
  // `transform:translateX(-50%) translateY(1px)` and a prefix test threw it away with the
  // reduced-motion rule that only recentres it — so the one control that composes its own
  // press read as a control with none.
  if (r.body === 'transform:none' || r.body === 'transform:translateX(-50%)') continue
  if (r.sel.includes('data-motion=off')) continue
  for (const c of controls(r, ':active')) pressing.add(c)
}

/**
 * Controls that hover and DO NOT press, each with the reason it does not.
 *
 * ⚠️ A CARVE NEEDS A BOX. Most of these are words rather than keys — padding:0, no surface —
 * and a shadow across a word is a smudge, so they answer with colour, which is what a word
 * can do. The rest own the property the carve would use.
 */
const NO_PRESS: Record<string, string> = {
  '.link-accent': 'a link in prose; the pen draws its underline',
  '.rail-row': 'a navigation link, not a key',
  '.link-card': 'a whole card that IS the link; it tints rather than carves',
  '.file-card': 'the same card, for an attachment',
  '.comment-google': 'an anchor, not a button',
  '.comment-reply': 'a word: padding 0, no surface',
  '.comment-form .comment-signout': 'a word, underlined: padding 0, no surface',
  '.pen-del': 'a word in the pen note: padding 0, no surface',
  '.pen-send': 'a word in the pen note: padding 0, no surface',
  '.pen-swatch': 'its box-shadow IS its ring; a second inset would fight the first',
  '.site-menu a': 'a list of links',
  '.prose a': 'a link in prose; the pen draws its underline',
  '.dark .prose a': 'the same link, on the dark palette',
  '.prose pre': 'not a control: the code block revealing the key sitting on it',
  '.pen-keep button': 'a word: padding 0, no surface, and it underlines rather than fills',
  // Links. A press is for a key; a link is answered by its underline and its colour, and the
  // pen draws the one in prose. Scoped rules rather than one, because each surface picks its
  // own hover colour.
  'a': 'a link',
  'aside.series li a': 'a link, in the series box',
  'footer.site a': 'a link, in the footer',
  '.rail-tags a': 'a link, in the rail',
  '.search-results a': 'a link, in the results list',
  '.fc-title a': 'a link, on a front-page card',
}

describe('the press is for everything a finger can press', () => {
  it('finds both lists in the sheet at all', () => {
    // A harness that silently parses nothing passes forever.
    expect(hovering.size).toBeGreaterThan(12)
    expect(pressing.size).toBeGreaterThan(8)
  })

  it('gives every hovering control either a press or a written reason', () => {
    const undecided = [...hovering].filter((c) => !pressing.has(c) && !(c in NO_PRESS))
    expect(undecided).toEqual([])
  })

  it('does not carry a reason for a control that presses after all', () => {
    // The other direction: a name left in NO_PRESS after its control was given a press is a
    // reason nobody reads, and the next person takes it for a decision.
    const stale = Object.keys(NO_PRESS).filter((c) => pressing.has(c))
    expect(stale).toEqual([])
  })

  it('presses the five boxes that were silent until 2026-09-20', () => {
    for (const cls of ['.overlay-close', '.book-fab', '.book-size', '.quote-copy', '.pen-bar button']) {
      expect(pressing.has(cls), cls).toBe(true)
    }
  })

  it('carves an inverted surface in the paper colour, never in the ink it is made of', () => {
    // The pen bar and the quote pill are `background:var(--c-heading)`. The shared carve is
    // that same ink at 22%, which on those two is a press nobody can see.
    const inverted = RULES.filter((r) => r.sel.includes(':active')
      && (r.sel.includes('.quote-copy') || r.sel.includes('.pen-bar')))
    expect(inverted.length).toBeGreaterThan(0)
    for (const r of inverted) {
      if (!r.body.includes('box-shadow')) continue
      expect(r.body, r.sel).toContain('var(--c-bg)')
      expect(r.body, r.sel).not.toContain('var(--c-heading)')
    }
  })

  it('carves the lightbox in white, because its scrim is black in every palette', () => {
    const lb = RULES.find((r) => r.sel.includes('.lightbox button:active') && r.body.includes('box-shadow'))
    expect(lb).toBeDefined()
    expect(lb!.body).toContain('rgba(255,255,255')
    // The counter-test: either palette token would follow the theme and go dark with it.
    expect(lb!.body).not.toContain('var(--c-heading)')
    expect(lb!.body).not.toContain('var(--c-bg)')
  })

  it('leaves the word-shaped buttons alone', () => {
    // `.comment-form button:active` is a DESCENDANT selector, so it caught the sign-out link
    // — padding 0, underlined, no surface — and carved a shadow across the words.
    const carve = RULES.find((r) => r.sel.includes('.comment-form button') && r.sel.includes(':active'))
    expect(carve).toBeDefined()
    expect(carve!.sel).toContain(':not(.comment-signout)')
  })
})
