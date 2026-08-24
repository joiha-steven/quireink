// Focus mode: one switch that takes everything off the writing screen except the writing.
//
// The DEFAULT does not change and is not up for debate here: the button row is the owner's
// explicit pick (see `EditorMenus.tsx`) and the write pane is the Writing Desk mock's own
// frame. This is the other half of both decisions — a way to put them away for an hour
// without arguing with either. Formatting still works while they are away: the bubble bar
// on a selection and "/" at the caret are the same commands the row holds.
//
// It lives in localStorage, not in Settings, because it is a fact about this person at this
// desk this afternoon rather than a fact about the blog — the same reasoning as the rail's
// icon switch.
//
// Two readers, and they are not on one branch of the tree: the PAGE draws the pane, the
// EDITOR draws the button row, and the switch itself sits in the action line inside the
// form. A window event is how the three stay in step without threading a setter through a
// component that has no interest in it.

import { useCallback, useEffect, useState } from 'react'

const KEY = 'quireink-admin-focus'
const EVENT = 'quireink:focus'

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    // Private mode, or storage disabled by policy. A preference that cannot be stored is
    // simply off; it must never be the reason an editor fails to open.
    return false
  }
}

export function useFocusMode(): [boolean, (on: boolean) => void] {
  // Starts false and is corrected after mount rather than read during render: this is a
  // client-only SPA, but a synchronous storage read in a render path is the kind of thing
  // that ends up in a server tree later and throws where nobody is looking.
  const [on, setOn] = useState(false)

  useEffect(() => {
    setOn(read())
    const sync = () => setOn(read())
    window.addEventListener(EVENT, sync)
    return () => window.removeEventListener(EVENT, sync)
  }, [])

  const set = useCallback((next: boolean) => {
    try {
      localStorage.setItem(KEY, next ? '1' : '0')
    } catch {
      /* see read() */
    }
    setOn(next)
    window.dispatchEvent(new Event(EVENT))
  }, [])

  return [on, set]
}
