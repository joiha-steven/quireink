// Remember how far down a post the reader got, and offer the way back.
//
// A forty-minute read is never one sitting. The place a reader stopped lives in THEIR
// browser (localStorage, keyed by path) and nowhere else — no account, no cookie, nothing
// sent — which is the same bargain the whole comment gate was built on: the blog does not
// need to know who you are to be polite to you.
//
// The offer is one quiet pill, and it withdraws itself: the moment the reader starts
// scrolling on their own they have answered, and a control that answers a question nobody
// asked has to go quietly. Finishing a post (past 92%) forgets it — "continue where you
// left off" at the end of a text is not memory, it is nagging.

import { el, label, onScrollFrame } from './dom'

const KEY = 'quire:resume:'
const MIN_Y = 1.5 // viewports read before a position is worth keeping
const DONE = 0.92 // this far through counts as finished -> forget
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000
const SAVE_STEP = 400 // px of travel between writes, so scrolling is not a write storm

type Mark = { y: number; t: number }

function read(key: string): Mark | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const mark = JSON.parse(raw) as Mark
    return typeof mark?.y === 'number' && typeof mark?.t === 'number' ? mark : null
  } catch {
    return null
  }
}

export function resume(): void {
  // The label only rides the body on a post page with the feature on — no words, no island.
  const text = label('resumePrompt')
  if (!text) return
  const key = KEY + location.pathname

  // ---- the offer, before this visit starts writing over the mark -----------------------
  const mark = read(key)
  const doc = () => document.documentElement.scrollHeight - innerHeight
  if (mark && Date.now() - mark.t < MAX_AGE_MS && scrollY < innerHeight
    && mark.y > innerHeight * MIN_Y && doc() > 0 && mark.y / doc() < DONE) {
    const target = Math.min(mark.y, doc())
    const pill = el('button', { type: 'button', class: 'resume-pill' }, text)
    pill.addEventListener('click', () => {
      const still = matchMedia('(prefers-reduced-motion:reduce)').matches
      scrollTo({ top: target, behavior: still ? 'auto' : 'smooth' })
      pill.remove()
    })
    document.body.appendChild(pill)
    requestAnimationFrame(() => pill.classList.add('shown'))
    // Scrolling IS the answer. A small allowance first, because opening a page nudges
    // scrollY on its own (anchor, restored position, mobile chrome settling).
    const from = scrollY
    const away = () => {
      if (Math.abs(scrollY - from) > 200 && pill.isConnected) pill.remove()
    }
    addEventListener('scroll', away, { passive: true })
  }

  // ---- keeping the mark ----------------------------------------------------------------
  let saved = -Infinity
  const write = () => {
    const height = doc()
    if (height <= 0) return
    try {
      if (scrollY / height >= DONE) {
        localStorage.removeItem(key)
      } else if (scrollY > innerHeight * MIN_Y) {
        localStorage.setItem(key, JSON.stringify({ y: Math.round(scrollY), t: Date.now() }))
      } else {
        return // above the threshold: keep whatever an earlier sitting stored
      }
      saved = scrollY
    } catch { /* private mode */ }
  }
  onScrollFrame(() => {
    if (Math.abs(scrollY - saved) > SAVE_STEP) write()
  })
  // The scroll that mattered most is the one in flight when the tab goes: write it then.
  addEventListener('pagehide', write)
}
