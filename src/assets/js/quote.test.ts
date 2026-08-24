// The quote gesture, and the two things about it that would fail silently.
//
// The BUTTON is easy to see broken. What is not: the link. A `#:~:text=` fragment that is
// encoded wrong does not throw and does not look wrong — it opens the post at the top,
// exactly as if the reader had pasted a plain URL, and nobody ever finds out that the one
// job the gesture exists for stopped working. Two characters do that on their own: `-`
// separates a prefix from its text in the fragment syntax and `,` separates start from end,
// and `encodeURIComponent` leaves both alone.

import { beforeEach, describe, expect, it } from 'bun:test'
import { quote } from './quote'
import { page, useDom } from './test-dom'

useDom()

const LABELS = { quoteCopy: 'Copy quote', quoteCopied: 'Copied' }
// Carries both characters the fragment syntax reserves (`-` and `,`) inside the first 44,
// and then Vietnamese, which is what the encoding bug was actually about.
const ARTICLE = '<div class="prose"><p id="one">A well-set page, and nothing else, proves it. Nếu bạn có đọc bài đó thì xin cảm ơn.</p></div>'

/** Select `length` characters of the paragraph, then let the debounce run. */
async function select(length: number): Promise<void> {
  const node = document.getElementById('one')!.firstChild!
  const range = document.createRange()
  range.setStart(node, 0)
  range.setEnd(node, length)
  const selection = window.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
  document.dispatchEvent(new Event('selectionchange'))
  await new Promise((done) => setTimeout(done, 200))
}

const button = () => document.querySelector<HTMLButtonElement>('.quote-copy')

/** Record what would have gone to the clipboard. */
function stubClipboard(): string[] {
  const written: string[] = []
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (text: string) => { written.push(text); return Promise.resolve() } },
  })
  return written
}

beforeEach(() => page(ARTICLE, LABELS))

describe('the quote gesture', () => {
  it('offers itself on a selection and takes the link with it', async () => {
    const written = stubClipboard()
    quote()
    await select(46)
    expect(button()?.hidden).toBe(false)
    button()!.click()
    await new Promise((done) => setTimeout(done, 10))
    expect(written).toHaveLength(1)
    // The words the reader chose, and where they came from. Both, or it is a copy button.
    expect(written[0]).toContain('A well-set page, and nothing else, proves it.')
    expect(written[0]).toContain('#:~:text=')
  })

  it('escapes the characters that break a text fragment, and nothing else', async () => {
    const written = stubClipboard()
    quote()
    // 44 characters, so the quote travels whole: "A well-set page, and nothing else, …"
    await select(44)
    button()!.click()
    await new Promise((done) => setTimeout(done, 10))
    const fragment = written[0]!.split('#')[1]!
    // A bare `,` would be read as "start,end" and a bare `-` as "prefix-,text".
    expect(fragment).toContain('%2C')
    expect(fragment).toContain('%2D')
    expect(fragment).not.toMatch(/[^%2][-,]/)
  })

  it('leaves the letters alone, which is what makes the link readable', async () => {
    // The bug the owner reported on 2026-08-24: `encodeURIComponent` turns one Vietnamese
    // word into nine characters of hex, and a quoted sentence into 200 of them. A fragment
    // may carry UTF-8 as it is; only whitespace and the syntax's own separators may not.
    const written = stubClipboard()
    quote()
    const node = document.getElementById('one')!.firstChild!
    const range = document.createRange()
    range.setStart(node, 45)
    range.setEnd(node, 75)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
    await new Promise((done) => setTimeout(done, 200))
    button()!.click()
    await new Promise((done) => setTimeout(done, 10))
    const fragment = written[0]!.split('#')[1]!
    expect(fragment).toContain('Nếu')
    expect(fragment).not.toContain('%E1%BA%BF')
    // Spaces still have to go: a space ends a URL wherever one is pasted.
    expect(fragment).toContain('%20')
  })

  it('stays out of the way of a click that slipped', async () => {
    stubClipboard()
    quote()
    await select(4)
    expect(button()?.hidden).toBe(true)
  })

  it('draws nothing at all where there is no clipboard', async () => {
    // Any page served over plain http. A control that cannot do its one job is worse than
    // no control, so it is never built rather than built and left to fail on click.
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    quote()
    await select(46)
    expect(button()).toBeNull()
  })
})
