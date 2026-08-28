// The IDE chrome: one switch on the site's furniture, and what it must never touch.
//
// Split out of `typography.test.ts` when that file passed the 400-line cap. The cut is by
// SUBJECT rather than by size: everything here hangs off one attribute, has its own
// convention page (`docs/conventions/ide-chrome.md`), and none of it is about the owner's
// type settings — which is what the other file is about.
import { describe, expect, it } from 'bun:test'
import { PUBLIC_CSS } from '@/web/public.css'

describe('the IDE chrome is one switch, and off leaves no trace', () => {
  // The owner's brief: the furniture reads as source code while the reading column stays
  // analogue. The contrast IS the design, which also makes it a taste — so it is a switch,
  // and every rule behind it hangs off one attribute selector.
  /** Only the lines the switch owns — never the base sheet's, which say different things. */
  const idelines = () =>
    PUBLIC_CSS.split('\n').filter((l) => l.includes('data-ide-chrome')).join('\n')

  it('gates every rule on the attribute, so nothing leaks when it is off', () => {
    const ide = PUBLIC_CSS.split('\n').filter((l) => l.includes('data-ide-chrome'))
    expect(ide.length).toBeGreaterThan(8)
    // A rule that mentions the attribute in a comment but selects without it would apply
    // unconditionally. Every declaration line must carry the selector.
    for (const line of ide) expect(line).toContain('html[data-ide-chrome=on]')
  })

  it('never touches the reading column', () => {
    // The half that must NOT look technical: the article body, its title, the card
    // excerpts and the comment bodies are the reader's own words.
    for (const line of PUBLIC_CSS.split('\n').filter((l) => l.includes('data-ide-chrome'))) {
      for (const reading of ['.prose', '.reading-font', '.deck', '.comment-body', '.fs-h1']) {
        expect(line).not.toContain(reading)
      }
    }
  })

  it('borrows only theme tokens for its two syntax roles, and never the accent', () => {
    // An editor distinguishes a comment from a literal. That is the whole palette here:
    // labels are --c-meta, counts and dates are --c-text. No third colour, and no hex —
    // the same rule the rest of the public site follows.
    //
    // NOT --c-accent, which it was for one deploy. The accent is seeded from each palette's
    // link colour, so on a blog whose accent is red every date and count read as a link
    // that was not one. A syntax colour must not be the colour that means "click me".
    const ide = PUBLIC_CSS.split('\n').filter((l) => l.includes('data-ide-chrome')).join('\n')
    expect(ide).toContain('var(--c-text)')
    expect(ide).toContain('var(--c-meta)')
    expect(ide).not.toContain('var(--c-accent)')
    expect(ide).not.toContain('var(--c-link)')
    expect(ide).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })

  it('marks EVERY chrome label, not just the rail\'s', () => {
    // The treatment used to stop at the rail. Everything below it on an article page — the
    // related list, the sign-up card, the comment thread, the series head — is furniture
    // too, and it carried none of the marker, which is what the owner saw: a page that
    // read as source code for two inches and then gave up.
    const ide = idelines()
    for (const label of [
      '.rail h2::before', 'header.site .tagline::before', 'aside.series .series-head::before',
      '.related h2::before', '.subscribe-card h2::before', '#comments h2::before',
      '.empty::before',
    ]) expect(ide).toContain(label)
  })

  it('brackets every literal from the SHEET, so two renderers cannot disagree', () => {
    // The sidebar typed its own parentheses, so the taxonomy read "(7)" three lines under a
    // list that read "[7]". Both pairs come from CSS now — the round ones from the base
    // sheet, the square ones from the switch — which is also what makes it reversible.
    expect(PUBLIC_CSS).toContain('.term-count::before{content:"("}')
    const ide = idelines()
    for (const literal of [
      '.rail-count::before', '.pager-count::before', '.t-small time::before',
      '.comment-meta time::before', '.related p::before', '.num::before',
    ]) expect(ide).toContain(literal)
  })

  it('sets the brackets a shade lighter than the value they hold', () => {
    // They are punctuation, not the value. At the same weight as the digits a meta line
    // reads as a row of boxes rather than as a date followed by two figures.
    expect(idelines()).toContain('.num::before{content:"[";color:var(--c-meta)}')
    expect(idelines()).toContain('.num::after{content:"]";color:var(--c-meta)}')
  })

  it('brackets the rail\'s term counts too, and does not ring them', () => {
    // They were a filled ring for one deploy, on the reasoning that a term cloud has no
    // sequence to punctuate. The owner looked at it and said it was ugly, which settles it —
    // and one bracket for every literal is the simpler rule to hold anyway.
    expect(idelines()).toContain('.term-count::before')
    // The whole of what the switch does to it: lift the base sheet's .6 opacity. Anything
    // more and the ring is back. (`border-radius:50%` alone is no test — the feed's dots and
    // the index's line numbers are circles too.)
    const block = /html\[data-ide-chrome=on] \.term-count\{[^}]*}/.exec(PUBLIC_CSS)?.[0] ?? ''
    expect(block).toBe('html[data-ide-chrome=on] .term-count{opacity:1}')
  })

  it('marks the info panel\'s one ACTION, and leaves the comment invitation alone', () => {
    // Book mode is the only row in the panel that does something rather than states
    // something, so it takes the label's marker. "Be the first to comment" is an invitation
    // to the reader rather than a label on a section, and the owner asked for it bare.
    const ide = idelines()
    expect(ide).toContain('.info-action::before')
    expect(ide).toContain('#comments .empty::before{content:none}')
  })

  it('swaps the header icons for tokens, and puts BOTH in the markup', () => {
    // The owner's condition, in as many words: this style only applies when the switch is
    // on. So the icons are still there with it off, and the sheet decides which of the two
    // has a box — the same arrangement as the article's info panel.
    const ide = idelines()
    expect(ide).toContain('.icon-btn svg{display:none}')
    expect(ide).toContain('.btn-token{display:inline}')
    expect(PUBLIC_CSS).toContain('.btn-token{display:none;') // ...and OFF is the default
  })

  it('numbers a sub-heading within its parent, not straight through the list', () => {
    // counter-SET, not counter-reset: a reset on the parent row creates a new instance
    // scoped to that row and its siblings, and the children went on reading the outer one.
    // Measured before the fix, the index ran 1.1 1.2 2.3 2.4 2.5 3.6.
    const ide = idelines()
    expect(ide).toContain('counter-increment:h2;counter-set:h3 0')
    expect(ide).toContain('content:counter(h2) "." counter(h3)')
    // A child is a path segment, so it takes the slash and drops the smaller size.
    expect(ide).toContain('.rail-sub::before{content:"/"')
  })

  it('gives the archive year a path mark rather than brackets', () => {
    // The feed's right gutter is a year over its months: a path, not a count. Brackets mean
    // "index" everywhere else here, and using them for a directory would say the wrong
    // thing in the one place the site already has a hierarchy to show.
    expect(idelines()).toContain('.tl-year-tag::after{content:"/"')
  })
})
