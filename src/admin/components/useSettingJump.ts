// Scroll to a setting and mark it, once the tab holding it has rendered.
//
// Landing on the right tab is only half of what a search result promises; the other half is
// not then hunting the card. Split out of `SettingsView` when that file passed the 400-line
// ceiling, and it earns its own file anyway: everything here is about the DOM after a render,
// and nothing about settings.

import { useEffect, useRef, useState } from 'react'

/** How long the mark stays. Matches the `setting-found` animation in `admin.css`. */
const MARK_MS = 1600

/**
 * Frames to keep looking before giving up.
 *
 * ~40 is two thirds of a second at 60Hz. A single `requestAnimationFrame` was the first
 * attempt and it missed every time: a tab is not on screen the instant its state changes —
 * System renders a backup list it has to fetch, Connections a token list — so the target was
 * reliably absent at the one moment the code looked. Past this it is not coming, and a scroll
 * that fires late lands after the reader has moved on.
 */
const MAX_FRAMES = 40

/**
 * Returns `jump(label)`: go to the element whose rendered text is exactly `label`.
 *
 * FOUND BY TEXT, not by id. Both the caller and the screen read the same `t[key]`, so there is
 * no second identifier to keep in sync — and an index entry that stops matching is exactly an
 * index entry that has gone stale, which the tour's completeness flow already fails on.
 *
 * The target is held in a REF, and a counter fires the effect. It was state first and the mark
 * never appeared: clearing that state inside the callback re-rendered the settings tree, React
 * replaced the very node the class had just been put on, and the highlight went with it.
 * Nothing in here may touch state after the DOM work.
 */
export function useSettingJump(): (label: string) => void {
  const target = useRef<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const want = target.current
    if (want === null) return
    target.current = null
    let frame = 0
    let tries = 0
    const look = () => {
      const match = [...document.querySelectorAll<HTMLElement>('main label, main span, main div')]
        .find((el) => el.textContent?.trim() === want && el.children.length === 0)
      if (!match) {
        if (++tries < MAX_FRAMES) frame = requestAnimationFrame(look)
        return
      }
      match.scrollIntoView({ block: 'center', behavior: 'smooth' })
      // The label's own box, so the mark frames the setting rather than the word.
      const box = match.closest('label') ?? match
      box.classList.add('setting-found')
      window.setTimeout(() => box.classList.remove('setting-found'), MARK_MS)
    }
    frame = requestAnimationFrame(look)
    return () => cancelAnimationFrame(frame)
  }, [nonce])

  return (label: string) => {
    target.current = label
    setNonce((n) => n + 1)
  }
}
