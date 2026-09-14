// THE SETTINGS FORM'S DIFF, which is the one thing on that screen that can be quietly wrong.
//
// Everything else fails loudly: a control that does not draw is missing, a route that refuses
// says so. A diff that reads the wrong baseline saves a value nobody typed, or counts a change
// that is not there, or — worst — sends nothing and reports success.
//
// A partial that names one leaf is safe to send because `saveSettings` deep-merges — pinned by
// `content/settings.test.ts` since 2026-08-02, when a patch carrying only a title reset
// `home.mode` and turned off somebody's composed front page.
//
// ⚠️ THERE IS NO COPY OF THE SETTINGS IN THE PAGE. What a field WAS is what the browser already
// holds for it: `defaultValue` on an input or a textarea (the `value=` the server wrote),
// `defaultSelected` on an option, `data-was` on the two controls that are not form elements at
// all. These tests are what hold that claim up.
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { htmlOf } from '@/web/admin/mark-html'
import {
  changedCount, changedIn, fieldsIn, isDirty, partialOf, settle,
} from './lib/settings-form'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

let root: HTMLElement
beforeEach(() => {
  document.body.innerHTML = ''
  root = document.createElement('div')
  document.body.appendChild(root)
})

const draw = (markup: string): HTMLElement => { root.innerHTML = markup; return root }

const TEXT = '<input data-k="title" value="Quire Ink">'
const NUMBER = '<input type="number" data-k="postsPerPage" value="10">'
const AREA = '<textarea data-k="description">Paper and ink</textarea>'
const SELECT = '<select data-k="language"><option value="en" selected>EN</option><option value="vi">VI</option></select>'
const SWITCH = '<button data-switch data-k="showLogo" data-was="0" aria-checked="false"></button>'
const CHOICE = '<div data-choice-track data-k="shape.corner" data-was="soft">'
  + '<button data-choice="soft" aria-pressed="true"></button>'
  + '<button data-choice="sharp" aria-pressed="false"></button></div>'
const NESTED = '<input type="number" data-k="typography.body.size" value="16">'

describe('a form nobody has touched has nothing to save', () => {
  it('counts no change across every kind of control', () => {
    draw(TEXT + NUMBER + AREA + SELECT + SWITCH + CHOICE + NESTED)
    expect(changedCount(fieldsIn(root))).toBe(0)
    expect(partialOf(fieldsIn(root))).toEqual({})
  })

  it("reads a switch's baseline from `data-was`, which is all a button has", () => {
    draw(SWITCH)
    const sw = root.querySelector<HTMLElement>('[data-switch]')!
    expect(isDirty(sw)).toBe(false)
    sw.setAttribute('aria-checked', 'true')
    expect(isDirty(sw)).toBe(true)
  })

  it("reads a segmented choice's baseline the same way", () => {
    draw(CHOICE)
    const track = root.querySelector<HTMLElement>('[data-choice-track]')!
    expect(isDirty(track)).toBe(false)
    track.querySelector('[data-choice="soft"]')!.setAttribute('aria-pressed', 'false')
    track.querySelector('[data-choice="sharp"]')!.setAttribute('aria-pressed', 'true')
    expect(isDirty(track)).toBe(true)
  })

  it("reads a select's baseline from the option the SERVER marked, not the first one", () => {
    draw('<select data-k="language"><option value="en">EN</option><option value="vi" selected>VI</option></select>')
    const el = root.querySelector<HTMLSelectElement>('select')!
    expect(isDirty(el)).toBe(false)
    el.value = 'en'
    expect(isDirty(el)).toBe(true)
  })
})

describe('what is sent is what moved, and nothing else', () => {
  it('sends one key when one field is typed into', () => {
    draw(TEXT + NUMBER + AREA)
    root.querySelector<HTMLInputElement>('[data-k="title"]')!.value = 'Mực'
    expect(partialOf(fieldsIn(root))).toEqual({ title: 'Mực' })
  })

  it('sends a number as a NUMBER, which is what the record holds', () => {
    draw(NUMBER)
    root.querySelector<HTMLInputElement>('input')!.value = '25'
    expect(partialOf(fieldsIn(root))).toEqual({ postsPerPage: 25 })
  })

  it('sends a switch as a BOOLEAN', () => {
    draw(SWITCH)
    root.querySelector<HTMLElement>('[data-switch]')!.setAttribute('aria-checked', 'true')
    expect(partialOf(fieldsIn(root))).toEqual({ showLogo: true })
  })

  it('refuses to send a number field that has been emptied', () => {
    // `Number('')` is 0, which `saveSettings` would store and every later read would have to
    // defend against. Sending nothing leaves the stored value alone.
    draw(NUMBER)
    root.querySelector<HTMLInputElement>('input')!.value = ''
    expect(partialOf(fieldsIn(root))).toEqual({})
  })

  it('rebuilds a dotted key into the object the endpoint merges', () => {
    draw(NESTED)
    root.querySelector<HTMLInputElement>('input')!.value = '17'
    expect(partialOf(fieldsIn(root))).toEqual({ typography: { body: { size: 17 } } })
  })

  it('gathers every dirty key under one root into the SAME object', () => {
    // `PUT /api/settings` merges at the top level only, so two changes under `typography` have
    // to arrive as one object or the second would wipe the first.
    draw('<input data-k="typography.body" value="16"><input data-k="typography.title" value="30">')
    for (const el of root.querySelectorAll<HTMLInputElement>('input')) el.value = `${Number(el.value) + 1}`
    expect(partialOf(fieldsIn(root))).toEqual({ typography: { body: '17', title: '31' } })
  })

  it('ignores the colour picker, which echoes the field that saves', () => {
    // Two inputs, one value: only the hex carries `data-k`. A colour that could be stored from
    // either would be two answers to one question.
    draw('<input type="color" data-k-echo="inks.yellow" value="#112233">'
      + '<input data-k="inks.yellow" value="112233">')
    expect(fieldsIn(root)).toHaveLength(1)
    root.querySelector<HTMLInputElement>('[data-k]')!.value = 'AABBCC'
    expect(partialOf(fieldsIn(root))).toEqual({ inks: { yellow: 'AABBCC' } })
  })
})

describe('the shapes that are not plain objects', () => {
  // ⚠️ EVERY HIDDEN FIELD CARRIES `data-was`, and it is not decoration. A hidden input keeps its
  // `value` IDL attribute in "default mode": setting `.value` writes the content attribute, so
  // `defaultValue` moves with it and the field can NEVER look changed. Five settings ride hidden
  // fields — both logos, the portrait, `enabledPalettes`, `customFont` — and without the
  // baseline every one of them would be chosen in the picker, drawn on screen, and not sent.

  // ⚠️ THREE SETTINGS ARE ARRAYS — `menu`, `featured` and `home.front.strips` — and a dotted
  // path builds an object by default. `{menu:{0:{label}}}` typechecks, renders and writes the
  // wrong shape: `sanitizeMenu` walks an array, and an object with a `"0"` key is not one, so
  // all three would have saved as nothing at all.
  it('turns a numeric path segment into an array element', () => {
    draw('<input data-k="menu.0.label" value="Home"><input data-k="menu.0.href" value="/">'
      + '<input data-k="menu.1.label" value="About"><input data-k="menu.1.href" value="/about">')
    for (const el of root.querySelectorAll<HTMLInputElement>('input')) el.value += '!'
    const out = partialOf(fieldsIn(root)) as { menu?: unknown }
    expect(Array.isArray(out.menu)).toBe(true)
    expect(out.menu).toEqual([{ label: 'Home!', href: '/!' }, { label: 'About!', href: '/about!' }])
  })

  it('makes an array of plain values, not an array of objects', () => {
    draw('<input data-k="featured.0" value="a"><input data-k="featured.1" value="b">')
    for (const el of root.querySelectorAll<HTMLInputElement>('input')) el.value += 'z'
    expect(partialOf(fieldsIn(root))).toEqual({ featured: ['az', 'bz'] })
  })

  it('opens an array inside an object inside an array', () => {
    draw('<input type="number" data-k="home.front.strips.0.count" value="3">')
    root.querySelector<HTMLInputElement>('input')!.value = '4'
    expect(partialOf(fieldsIn(root))).toEqual({ home: { front: { strips: [{ count: 4 }] } } })
  })

  it('sends a boolean when the strip says its value is one', () => {
    // `figure.ink` is a two-option strip over a boolean, and `sanitizeFigure` discards a
    // string — so a plain choice on it saved nothing at all.
    draw('<div data-choice-track data-k="figure.ink" data-k-bool data-was="0">'
      + '<button data-choice="1" aria-pressed="false"></button>'
      + '<button data-choice="0" aria-pressed="true"></button></div>')
    const track = root.querySelector<HTMLElement>('[data-choice-track]')!
    track.querySelector('[data-choice="0"]')!.setAttribute('aria-pressed', 'false')
    track.querySelector('[data-choice="1"]')!.setAttribute('aria-pressed', 'true')
    expect(partialOf(fieldsIn(root))).toEqual({ figure: { ink: true } })
  })

  it('splits a list field into an array', () => {
    // `enabledPalettes` has no control that holds a list, so it rides as space-separated names.
    // Without the split `sanitizeEnabledPalettes` reads a non-array as "turn all six on" — it
    // fails in the direction that switches on palettes the owner switched off.
    draw('<input type="hidden" data-k="enabledPalettes" data-k-list value="mono sepia" data-was="mono sepia">')
    root.querySelector<HTMLInputElement>('input')!.value = 'mono sepia ink'
    expect(partialOf(fieldsIn(root))).toEqual({ enabledPalettes: ['mono', 'sepia', 'ink'] })
  })

  it('parses an object field, and sends nothing when it will not parse', () => {
    draw('<input type="hidden" data-k="customFont" data-k-json data-was=\'{"family":"A","faces":[]}\''
      + ' value=\'{"family":"A","faces":[]}\'>')
    const el = root.querySelector<HTMLInputElement>('input')!
    el.value = '{"family":"B","faces":[{"weight":400}]}'
    expect(partialOf(fieldsIn(root))).toEqual({ customFont: { family: 'B', faces: [{ weight: 400 }] } })
    // A half-written value sends nothing rather than a string: `sanitizeFont` reads a string as
    // no font at all, which would drop every uploaded face.
    el.value = '{"family":'
    expect(partialOf(fieldsIn(root))).toEqual({})
  })

  it('sends a number when the select says its value is one', () => {
    // A select's value is always a string; `home.front.columns` is 1, 2 or 3 in the record.
    draw('<select data-k="home.front.columns" data-k-number>'
      + '<option value="1">1</option><option value="2" selected>2</option></select>')
    root.querySelector<HTMLSelectElement>('select')!.value = '1'
    expect(partialOf(fieldsIn(root))).toEqual({ home: { front: { columns: 1 } } })
  })
})

describe('the count, and whose change it is', () => {
  it('counts one per key, however many kinds of control moved', () => {
    draw(TEXT + SWITCH + CHOICE)
    expect(changedCount(fieldsIn(root))).toBe(0)
    root.querySelector<HTMLInputElement>('[data-k="title"]')!.value = 'x'
    root.querySelector<HTMLElement>('[data-switch]')!.setAttribute('aria-checked', 'true')
    expect(changedCount(fieldsIn(root))).toBe(2)
  })

  it('answers whether a named card has work in it, not just the page', () => {
    // A card on a save-itself tab lights its own lamp: the page-level count answers "is there
    // work on this screen", and a card needs "is there work in MY box".
    draw('<input data-k="mcp.enabled" value="1"><input data-k="title" value="Quire Ink">')
    root.querySelector<HTMLInputElement>('[data-k="mcp.enabled"]')!.value = '0'
    expect(changedIn(fieldsIn(root), 'mcp')).toBe(true)
    expect(changedIn(fieldsIn(root), 'backups')).toBe(false)
    expect(changedIn(fieldsIn(root), 'title')).toBe(false)
  })
})

describe('one setting drawn twice is still one setting', () => {
  // The comments master switch is on two tabs, which is how React had it: one component, one
  // piece of state. Two independent DOM controls do not stay in step on their own.
  const TWINS = '<button data-switch data-k="comments.enabled" data-was="1" aria-checked="true"></button>'
    + '<button data-switch data-k="comments.enabled" data-was="1" aria-checked="true"></button>'

  it('counts one change when both copies move, not two', () => {
    draw(TWINS)
    for (const el of root.querySelectorAll('[data-switch]')) el.setAttribute('aria-checked', 'false')
    expect(changedCount(fieldsIn(root))).toBe(1)
    expect(partialOf(fieldsIn(root))).toEqual({ comments: { enabled: false } })
  })

  it('settles every copy, so neither is left looking dirty', () => {
    draw(TWINS)
    for (const el of root.querySelectorAll('[data-switch]')) el.setAttribute('aria-checked', 'false')
    settle(fieldsIn(root))
    expect(changedCount(fieldsIn(root))).toBe(0)
    for (const el of root.querySelectorAll<HTMLElement>('[data-switch]')) {
      expect(el.dataset.was).toBe('0')
    }
  })
})

describe('a save that lands moves the baseline, not the value', () => {
  it('goes to zero without changing anything on screen', () => {
    draw(TEXT + NUMBER + SELECT + SWITCH + CHOICE)
    const title = root.querySelector<HTMLInputElement>('[data-k="title"]')!
    const sel = root.querySelector<HTMLSelectElement>('select')!
    const sw = root.querySelector<HTMLElement>('[data-switch]')!
    title.value = 'Mực'
    sel.value = 'vi'
    sw.setAttribute('aria-checked', 'true')
    expect(changedCount(fieldsIn(root))).toBe(3)

    settle(fieldsIn(root))
    expect(changedCount(fieldsIn(root))).toBe(0)
    // What is ON SCREEN is untouched: the count fell because the server caught up.
    expect(title.value).toBe('Mực')
    expect(sel.value).toBe('vi')
    expect(sw.getAttribute('aria-checked')).toBe('true')
  })

  it('leaves a field dirty again the moment it moves after a save', () => {
    draw(TEXT)
    const title = root.querySelector<HTMLInputElement>('input')!
    title.value = 'one'
    settle(fieldsIn(root))
    title.value = 'two'
    expect(changedCount(fieldsIn(root))).toBe(1)
    expect(partialOf(fieldsIn(root))).toEqual({ title: 'two' })
  })
})

describe('the markup the server sends is the markup this reads', () => {
  it('finds every control a rendered tab draws', async () => {
    const { blogTab } = await import('@/web/admin/screens/settings-blog')
    const { adminT } = await import('@/i18n/admin-i18n')
    const { DEFAULT_SETTINGS } = await import('@/content/settings')
    draw(blogTab(adminT('en'), DEFAULT_SETTINGS))
    const keys = fieldsIn(root).map((el) => el.dataset.k)
    // Every key the Blog tab is responsible for, and no duplicates: a key drawn twice is two
    // controls fighting over one value.
    expect(new Set(keys).size).toBe(keys.length)
    for (const want of ['title', 'description', 'language', 'timezone', 'siteUrl', 'showLogo',
      'logoUrl', 'logoDarkUrl', 'logoWidth', 'faviconUrl', 'appIconUrl',
      'author.name', 'author.bio', 'author.url', 'author.avatarUrl']) {
      expect(keys).toContain(want)
    }
    // Nothing is dirty on a freshly drawn tab, which is the whole claim.
    expect(changedCount(fieldsIn(root))).toBe(0)
    expect(htmlOf).toBeDefined()
  })
})

describe('a hidden field can be seen to change at all', () => {
  // The regression test for the worst bug this screen nearly shipped. An `input[type=hidden]`
  // keeps `value` and `defaultValue` in lockstep, so a diff that reads `defaultValue` would
  // report a chosen logo as unchanged and send nothing — the picture on screen and the record
  // disagreeing, with nothing saying so.
  it('reports a hidden field as dirty once its value moves', () => {
    draw('<input type="hidden" data-k="logoUrl" value="/a.png" data-was="/a.png">')
    const el = root.querySelector<HTMLInputElement>('input')!
    expect(isDirty(el)).toBe(false)
    el.value = '/b.png'
    expect(el.defaultValue).toBe(el.value) // the trap, stated out loud
    expect(isDirty(el)).toBe(true)
    expect(partialOf(fieldsIn(root))).toEqual({ logoUrl: '/b.png' })
  })

  it('settles a hidden field by moving its baseline', () => {
    draw('<input type="hidden" data-k="logoUrl" value="/a.png" data-was="/a.png">')
    const el = root.querySelector<HTMLInputElement>('input')!
    el.value = '/b.png'
    settle(fieldsIn(root))
    expect(el.dataset.was).toBe('/b.png')
    expect(changedCount(fieldsIn(root))).toBe(0)
  })
})
