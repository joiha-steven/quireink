// THE TWO CODE BOXES: custom CSS, and the two HTML snippets.
//
// Both are a `<textarea>` with a line gutter welded to its left edge, and both have exactly one
// opinion about what is in them. The CSS box counts braces, because an unclosed one is how a
// stylesheet does NOTHING — not partly, not visibly, nothing — and the box gave no sign of it:
// you saved, the page did not change, and nowhere on the screen said why. The snippet boxes
// check for an unclosed `<script>` or `<style>`, which swallows the rest of the page.
//
// The counting lives in `@/admin-shared/css-brace` and `@/admin-shared/snippet`, where the
// SERVER reads it too: it draws the first state, the island keeps up with the typing, and a
// second implementation would be a second answer to "is this broken".
import { braceBalance } from '@/admin-shared/css-brace'
import { snippetBytes, unclosed } from '@/admin-shared/snippet'

const show = (el: Element | null, on: boolean): void => {
  if (el instanceof HTMLElement) el.hidden = !on
}

/** One `<div>` per line, which is what makes the gutter line up without measuring anything. */
function gutter(box: HTMLTextAreaElement, rail: HTMLElement): void {
  const lines = box.value.split('\n').length
  if (rail.childElementCount === lines) return
  const frag = document.createDocumentFragment()
  for (let i = 1; i <= lines; i++) {
    const row = document.createElement('div')
    row.textContent = String(i)
    frag.appendChild(row)
  }
  rail.replaceChildren(frag)
}

/**
 * TAB INSERTS TWO SPACES, and that is a decision rather than an oversight.
 *
 * A code box that swallows Tab is a box a keyboard cannot leave, so Shift-Tab is left alone and
 * moves on as it always would. Two spaces rather than a tab character because every stylesheet
 * this admin ships is written that way.
 */
function tabKey(e: KeyboardEvent, box: HTMLTextAreaElement): void {
  if (e.key !== 'Tab' || e.shiftKey) return
  e.preventDefault()
  insert(box, '  ')
}

/** Write at the caret and leave it after what was written, so typing carries on. */
function insert(box: HTMLTextAreaElement, text: string): void {
  const from = box.selectionStart
  const to = box.selectionEnd
  box.value = `${box.value.slice(0, from)}${text}${box.value.slice(to)}`
  box.selectionStart = box.selectionEnd = from + text.length
  box.dispatchEvent(new Event('input', { bubbles: true }))
}

export function wireCode(screen: HTMLElement): void {
  for (const box of screen.querySelectorAll<HTMLTextAreaElement>('[data-css-editor]')) {
    wireOne(box, screen, 'css')
  }
  for (const box of screen.querySelectorAll<HTMLTextAreaElement>('[data-snippet-editor]')) {
    wireOne(box, screen, 'snippet')
  }

  // The contract panel: 39 class names the custom sheet is promised, each one insertable at the
  // caret rather than typed out of a doc in another window.
  screen.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const name = target.closest<HTMLElement>('[data-css-insert]')
    if (name?.dataset.cssInsert) {
      const box = screen.querySelector<HTMLTextAreaElement>('[data-css-editor]')
      if (box) { box.focus(); insert(box, name.dataset.cssInsert) }
      return
    }
    const toggle = target.closest<HTMLElement>('[data-css-reference]')
    if (!toggle) return
    const panel = screen.querySelector<HTMLElement>('[data-css-names]')
    if (!panel) return
    const open = panel.hidden
    panel.hidden = !open
    toggle.setAttribute('aria-expanded', String(open))
    toggle.textContent = (open ? toggle.dataset.on : toggle.dataset.off) ?? ''
  })
}

function wireOne(box: HTMLTextAreaElement, screen: HTMLElement, kind: 'css' | 'snippet'): void {
  const card = box.closest<HTMLElement>('section') ?? screen
  const rail = card.querySelector<HTMLElement>(`[data-${kind}-gutter]`)

  const retell = (): void => {
    if (rail) gutter(box, rail)
    if (kind === 'css') tellCss(card, box.value)
    else tellSnippet(card, box.value)
  }

  box.addEventListener('input', retell)
  box.addEventListener('keydown', (e) => tabKey(e, box))
  // The gutter follows the box rather than scrolling on its own: two scrollers side by side
  // drift apart the moment one of them has a different line height.
  if (rail) box.addEventListener('scroll', () => { rail.scrollTop = box.scrollTop })
  retell()
}

/** Three faces, one showing: how many lines, how many braces are open, or a stray closer. */
function tellCss(card: HTMLElement, css: string): void {
  const depth = braceBalance(css)
  const count = card.querySelector('[data-css-count]')
  const open = card.querySelector('[data-css-unclosed]')
  const stray = card.querySelector('[data-css-stray]')
  show(count, depth === 0)
  show(open, depth > 0)
  show(stray, depth < 0)
  const n = card.querySelector('[data-css-depth]')
  if (n instanceof HTMLElement && depth > 0) n.textContent = String(depth)
}

/**
 * Two faces: its size, or the tag it left open.
 *
 * The three sentences ride on the state wrapper as attributes — `{tag}` unreplaced — because the
 * island has no dictionary and the server has already translated them. An empty box says nothing
 * at all, which is what it had to say before anybody typed.
 */
function tellSnippet(card: HTMLElement, html: string): void {
  const state = card.querySelector<HTMLElement>('[data-snippet-state]')
  const size = card.querySelector('[data-snippet-size]')
  const problem = card.querySelector('[data-snippet-problem]')
  if (!state) return
  state.hidden = html === ''
  const bad = unclosed(html)
  show(size, bad === null)
  show(problem, bad !== null)
  if (size instanceof HTMLElement) {
    size.textContent = `${snippetBytes(html)} ${state.dataset.wordBytes ?? ''}`
  }
  if (problem instanceof HTMLElement && bad) {
    // A stray closing tag is its own sentence: the count going negative means the document has
    // one more `</script>` than it opened, which is a different fault from forgetting one.
    const said = bad.depth < 0 ? state.dataset.wordStray : state.dataset.wordUnclosed
    problem.textContent = (said ?? '').replace('{tag}', bad.tag)
  }
}
