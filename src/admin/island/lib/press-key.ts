// Press one key of a segmented strip, or let it go, wearing ITS OWN face for either.
//
// The faces come from the server (`keyFaces`, admin-shared/tabs.ts) because a key's corners are
// part of its class: copying one pressed key's class onto another put the first key's rounding
// on the last (2026-09-30). A key drawn without them keeps its class and only its state moves.
export function pressKey(key: HTMLElement, on: boolean, state: 'aria-pressed' | 'aria-selected' = 'aria-pressed'): void {
  key.setAttribute(state, String(on))
  const face = on ? key.dataset.on : key.dataset.off
  if (face !== undefined) key.className = face
}
