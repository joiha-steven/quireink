// THE CONTROLS THE BROWSER CANNOT MOVE ON ITS OWN.
//
// Most of the settings screen needs no JavaScript at all: a text field, a number, a textarea, a
// select and a checkbox all hold their own value, and `settings-form.ts` reads them straight off
// the DOM when it is time to save. What is here is the short list of controls that are NOT
// native form elements and therefore have to be told what they are:
//
//   · the SWITCH, which is a `<button role="switch">` because a switch draws no text of its own
//     and a `<label>` cannot name a `<button>`;
//   · the SEGMENTED CHOICE, which is a row of buttons carrying `aria-pressed`;
//   · the COLOUR, which is two inputs over one value and has to keep them in step;
//   · the SLIDER's readout;
//   · the GATE and the CURTAIN, which show a row that depends on another row's answer.
//
// Every one of them ships drawn in the state the server could see. Nothing here builds a row.
import { KNOB_OFF, KNOB_ON, SWITCH_OFF, SWITCH_ON } from '@/admin-shared/controls'

/** What a control reports when it moves, so the form can recount without knowing what moved. */
export type OnMove = () => void

const html = (el: Element | null): HTMLElement | null => el instanceof HTMLElement ? el : null

/**
 * A switch is a button, so its state is `aria-checked` and two class strings.
 *
 * The pair lives in `@/admin-shared/controls`, where the server reads it too: the two faces
 * differ by a Tailwind colour with a dark variant, and a CSS rule keyed on `aria-checked` would
 * be a second copy of that token in `admin.css`.
 */
export function setSwitch(el: HTMLElement, on: boolean): void {
  el.setAttribute('aria-checked', String(on))
  el.className = on ? SWITCH_ON : SWITCH_OFF
  const knob = el.firstElementChild
  if (knob instanceof HTMLElement) knob.className = on ? KNOB_ON : KNOB_OFF
}

export const switchOn = (el: HTMLElement): boolean => el.getAttribute('aria-checked') === 'true'

/**
 * Everything the panels hold, wired in one pass.
 *
 * ONE listener on the root and not one per control: this screen draws around three hundred of
 * them, and three hundred listeners is three hundred closures held for the life of the page to
 * do what one `closest()` does on the click that actually happens.
 */
export function wireControls(root: HTMLElement, moved: OnMove): void {
  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement

    const sw = target.closest<HTMLElement>('[data-switch]')
    if (sw && !(sw as HTMLButtonElement).disabled) {
      const on = !switchOn(sw)
      setSwitch(sw, on)
      mirror(root, sw, (twin) => setSwitch(twin, on))
      applyGates(root)
      moved()
      return
    }

    const seg = target.closest<HTMLElement>('[data-choice]')
    const track = seg?.closest<HTMLElement>('[data-choice-track]')
    if (seg && track) {
      const value = seg.dataset.choice ?? ''
      pickChoice(track, value)
      mirror(root, track, (twin) => pickChoice(twin, value))
      applyGates(root)
      moved()
    }
  })

  // `input` and not `change`: a number typed into is dirty before it is left, and the Save key
  // has to say so while the finger is still on the keyboard.
  root.addEventListener('input', (e) => {
    const el = e.target
    if (!(el instanceof HTMLElement)) return
    if (el instanceof HTMLInputElement && el.type === 'range') readout(el)
    if (el.dataset.kEcho) echoColour(root, el as HTMLInputElement)
    if (el.dataset.k && el.classList.contains('font-mono')) echoWell(root, el as HTMLInputElement)
    moved()
  })

  root.addEventListener('change', (e) => {
    const el = e.target
    if (el instanceof HTMLElement && (el.dataset.k || el.dataset.kEcho)) {
      applyGates(root)
      moved()
    }
  })

  for (const el of root.querySelectorAll<HTMLInputElement>('input[type=range]')) readout(el)
  applyGates(root)
}

/**
 * ONE SETTING CAN BE DRAWN ON TWO TABS, and then both copies have to move together.
 *
 * The comments master switch is deliberately on both Posts ("should there be comments") and
 * Comments & mail ("how do readers answer back") — React drew one component twice and both read
 * one piece of state, so flipping either moved both. Two independent DOM controls do not do
 * that on their own: one would move, the other would keep showing the old answer, and the
 * form's diff would send whichever it walked into first.
 *
 * So a control's twins are found by the key it stores and told what it just did. `settle` moves
 * every copy's baseline for the same reason.
 */
function mirror(root: HTMLElement, el: HTMLElement, tell: (twin: HTMLElement) => void): void {
  const key = el.dataset.k
  if (!key) return
  for (const twin of root.querySelectorAll<HTMLElement>(`[data-k="${CSS.escape(key)}"]`)) {
    if (twin !== el) tell(twin)
  }
}

/** The strip's chosen key is CARVED into the track, and `aria-pressed` is what says so. */
function pickChoice(track: HTMLElement, value: string): void {
  const on = track.querySelector<HTMLElement>('[aria-pressed="true"]')?.className ?? ''
  const off = track.querySelector<HTMLElement>('[aria-pressed="false"]')?.className ?? ''
  for (const b of track.querySelectorAll<HTMLElement>('[data-choice]')) {
    const is = b.dataset.choice === value
    b.setAttribute('aria-pressed', String(is))
    if (on && off) b.className = is ? on : off
  }
  track.dataset.value = value
}

/** What a segmented choice currently holds, for the form's diff. */
export const choiceValue = (track: HTMLElement): string =>
  track.querySelector<HTMLElement>('[aria-pressed="true"]')?.dataset.choice ?? ''

/** The number beside a slider, which is the only thing that says what it is set to. */
function readout(el: HTMLInputElement): void {
  const box = el.parentElement?.querySelector<HTMLElement>('[data-readout]')
  if (!box) return
  const unit = box.dataset.unit ?? ''
  box.textContent = `${el.value}${unit}`
}

/** The OS picker moved: put its answer in the hex field, which is the one that saves. */
function echoColour(root: HTMLElement, el: HTMLInputElement): void {
  const key = el.dataset.kEcho
  const hex = root.querySelector<HTMLInputElement>(`input[data-k="${CSS.escape(key ?? '')}"]`)
  if (hex) hex.value = el.value.replace(/^#/, '').toUpperCase()
  const well = html(el.parentElement)
  if (well) well.style.background = el.value
}

/** The hex was typed into: move the picker and the well to match, once it is a colour. */
function echoWell(root: HTMLElement, el: HTMLInputElement): void {
  const key = el.dataset.k ?? ''
  const full = `#${el.value.replace(/^#/, '')}`
  if (!/^#[0-9a-fA-F]{6}$/.test(full)) return
  const echo = root.querySelector<HTMLInputElement>(`input[data-k-echo="${CSS.escape(key)}"]`)
  if (echo) echo.value = full
  const well = html(echo?.parentElement ?? null)
  if (well) well.style.background = full
}

/**
 * A ROW THAT DEPENDS ON ANOTHER ROW'S ANSWER.
 *
 * `data-gate="<key>"` shows while that key is on; `data-gate-when="<key>=<value>"` while it holds
 * a particular value. A curtain (`data-reveal`) is the same question with an animation and the
 * `inert` that keeps the Tab key out of a row nobody can see.
 *
 * Read from the DOM every time rather than kept in a variable: the answer is already on the
 * screen, and a second copy of it is a second thing that can be wrong.
 */
export function applyGates(root: HTMLElement): void {
  const valueOf = (key: string): string => {
    const sw = root.querySelector<HTMLElement>(`[data-switch][data-k="${CSS.escape(key)}"]`)
    if (sw) return switchOn(sw) ? '1' : '0'
    const track = root.querySelector<HTMLElement>(`[data-choice-track][data-k="${CSS.escape(key)}"]`)
    if (track) return choiceValue(track)
    const field = root.querySelector<HTMLInputElement>(`[data-k="${CSS.escape(key)}"]`)
    if (!field) return ''
    return field.type === 'checkbox' ? (field.checked ? '1' : '0') : field.value
  }

  for (const box of root.querySelectorAll<HTMLElement>('[data-gate]')) {
    box.hidden = valueOf(box.dataset.gate ?? '') !== '1'
  }
  for (const box of root.querySelectorAll<HTMLElement>('[data-gate-when]')) {
    const [key = '', want = ''] = (box.dataset.gateWhen ?? '').split('=')
    box.hidden = valueOf(key) !== want
  }
  // "Either of these", which is how the comment integrations ask about themselves: the block
  // of keys belongs on screen while EITHER sign-in method is switched on.
  for (const box of root.querySelectorAll<HTMLElement>('[data-gate-any]')) {
    const keys = (box.dataset.gateAny ?? '').split(' ').filter(Boolean)
    box.hidden = !keys.some((k) => valueOf(k) === '1')
  }
  // "Any value but one", which is how the front page asks about its own mode: the list path
  // applies to every arrangement EXCEPT the plain list.
  for (const box of root.querySelectorAll<HTMLElement>('[data-gate-not]')) {
    const [key = '', avoid = ''] = (box.dataset.gateNot ?? '').split('=')
    box.hidden = valueOf(key) === avoid
  }
  // A row that stays VISIBLE and goes dead, which is not the same question as a row that goes
  // away: a switch whose feature has no engine behind it has to look unavailable rather than
  // off, or the owner flips it, sees it flip back, and concludes the admin is broken.
  for (const box of root.querySelectorAll<HTMLElement>('[data-dim-when], [data-disable-when]')) {
    const spec = box.dataset.dimWhen ?? box.dataset.disableWhen ?? ''
    const [key = '', when = ''] = spec.split('=')
    const dead = valueOf(key) === when
    box.classList.toggle('opacity-50', dead && box.hasAttribute('data-dim-when'))
    const inside = box.matches('button, input, select, textarea')
      ? [box]
      : [...box.querySelectorAll<HTMLElement>('button, input, select, textarea')]
    for (const el of inside) (el as HTMLButtonElement).disabled = dead
  }
  for (const box of root.querySelectorAll<HTMLElement>('[data-reveal]')) {
    const spec = box.dataset.reveal ?? ''
    // `!=` as well as `=`: the mat colour opens on every frame EXCEPT none, and a curtain that
    // only knows equality stays shut forever on a condition written the other way round.
    const not = spec.includes('!=')
    const [key = '', want] = spec.split(not ? '!=' : '=')
    const open = want === undefined
      ? valueOf(key) === '1'
      : not ? valueOf(key) !== want : valueOf(key) === want
    // The height animates in `admin.css`; `inert` and `aria-hidden` are what keep a screen
    // reader and the Tab key out of a row that is still in the document.
    if (open) box.setAttribute('data-open', '')
    else box.removeAttribute('data-open')
    box.setAttribute('aria-hidden', String(!open))
    box.toggleAttribute('inert', !open)
  }
}
