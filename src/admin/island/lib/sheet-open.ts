// OPENING AND SHUTTING THE ATTRIBUTES PANEL.
//
// One panel, two jobs, and the difference decides how it behaves. A plain visit — fixing a slug,
// adding a tag — stands BESIDE the writing where the window has room: the page behind it is not
// "behind" any more, it is the other half of what the writer is looking at, and dimming the
// paragraph you opened the panel to fix is the same mistake as covering it. The PUBLISH step is
// a sheet on top, because the questions are being answered about the piece rather than alongside
// it.
//
// ⚠️ IT CLAIMS TO BE MODAL ONLY WHEN IT IS ONE. A docked panel that says `aria-modal` tells a
// screen reader the rest of the page has gone, and the rest of the page is right there. The
// server cannot know — whether it docks is a question about the window — so the markup says
// nothing and this writes it.
const DOCK_AT = '(min-width: 85rem)'

export type Panel = {
  readonly open: boolean
  /** True while the panel is the PUBLISH step rather than a plain visit. */
  readonly asking: boolean
  show: (asking?: boolean) => void
  hide: () => void
  toggle: () => void
  destroy: () => void
}

export function wirePanel(root: HTMLElement, onShut: () => void): Panel {
  const panel = root.querySelector<HTMLElement>('[data-sheet-panel]')
  const scrim = root.querySelector<HTMLElement>('[data-panel-scrim]')
  const title = root.querySelector<HTMLElement>('[data-panel-title]')
  const intro = root.querySelector<HTMLElement>('[data-panel-intro]')
  const shutKey = root.querySelector<HTMLButtonElement>('[data-panel-shut]')
  const publishKey = root.querySelector<HTMLButtonElement>('[data-panel-publish]')
  if (!panel) {
    return { open: false, asking: false, show: () => {}, hide: () => {}, toggle: () => {}, destroy: () => {} }
  }

  let open = false
  let asking = false
  let opener: HTMLElement | null = null
  const wide = matchMedia(DOCK_AT)

  const paint = (): void => {
    // The publish step never docks, whatever the window.
    const docked = open && !asking && wide.matches
    panel.hidden = !open
    if (scrim) scrim.hidden = !open || docked
    if (docked) document.documentElement.dataset.adminSheet = 'docked'
    else delete document.documentElement.dataset.adminSheet
    if (docked) panel.removeAttribute('aria-modal')
    else if (open) panel.setAttribute('aria-modal', 'true')
    else panel.removeAttribute('aria-modal')

    const words = panel.dataset
    if (title) title.textContent = asking ? (words.sayPublishing ?? '') : (words.sayAttributes ?? '')
    panel.setAttribute('aria-label', title?.textContent ?? '')
    if (intro) intro.hidden = !asking
    if (publishKey) publishKey.hidden = !asking
    if (shutKey) {
      shutKey.textContent = asking
        ? (shutKey.dataset.sayLater ?? shutKey.textContent)
        : (shutKey.dataset.sayHide ?? shutKey.textContent)
    }
  }

  const show = (wantAsking = false): void => {
    if (!open) opener = document.activeElement as HTMLElement | null
    open = true
    asking = wantAsking
    paint()
    panel.focus()
  }
  const hide = (): void => {
    if (!open) return
    open = false
    asking = false
    paint()
    // Give focus back UNLESS something else has taken it: a close that followed a click on a
    // control elsewhere must not drag the keyboard away from it.
    const now = document.activeElement
    const elsewhere = now && now !== document.body && !panel.contains(now)
    if (!elsewhere) opener?.focus()
    onShut()
  }

  // Escape closes it. On the window rather than on the panel, because the keyboard may
  // legitimately be inside a field, a suggestion list or the calendar by then.
  const escape = (e: KeyboardEvent): void => { if (e.key === 'Escape' && open) hide() }
  const resize = (): void => { if (open) paint() }
  window.addEventListener('keydown', escape)
  wide.addEventListener('change', resize)
  scrim?.addEventListener('click', hide)
  shutKey?.addEventListener('click', hide)
  paint()

  return {
    get open() { return open },
    get asking() { return asking },
    show,
    hide,
    toggle: () => (open ? hide() : show()),
    destroy: () => {
      window.removeEventListener('keydown', escape)
      wide.removeEventListener('change', resize)
      delete document.documentElement.dataset.adminSheet
    },
  }
}
