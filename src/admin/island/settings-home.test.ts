// THE HOME TAB'S LISTS, DRIVEN THE WAY A PERSON DRIVES THEM.
//
// Every control asserted here was drawn by ADR 0054 and wired to nothing until 2026-09-15: Add,
// Remove, the two move keys and the footer's toolbar all did nothing when pressed. A markup test
// could not have caught it — the markup was right — and a unit test of the island could not
// either, because there was no island. What catches it is a CLICK.
//
// The second thing these pin is the value the Save key would send. Each list rides as one
// `data-k-json` field, because a field per row could not express a removal: the survivors
// renumbered back onto their own stored values, nothing was dirty, and the row came back on the
// next load. So every assertion below reads the hidden field, not the rows.
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { adminT } from '@/i18n/admin-i18n'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { homeTab } from '@/web/admin/screens/settings-home'
import { wireHome } from './lib/settings-home'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const t = adminT('en')

const view = {
  posts: [
    { slug: 'one', title: 'The first' },
    { slug: 'two', title: 'The second' },
    { slug: 'three', title: 'The third' },
  ],
  pages: [],
  categories: ['essays', 'notes'],
}

let root: HTMLElement

/** The screen as the server sends it, with a menu, a featured list and one strip already on it. */
const settings = {
  ...DEFAULT_SETTINGS,
  menu: [{ label: 'Home', href: '/' }, { label: 'About', href: '/about' }],
  featured: ['one', 'two'],
  footer: 'Set in **Souvenir**.',
  home: {
    ...DEFAULT_SETTINGS.home,
    mode: 'front' as const,
    front: {
      ...DEFAULT_SETTINGS.home.front,
      strips: [{ category: 'essays', count: 6, columns: 2 }],
    },
  },
}

beforeEach(() => {
  document.body.innerHTML = ''
  root = document.createElement('div')
  root.innerHTML = homeTab(t, settings, view)
  document.body.appendChild(root)
  wireHome(root, { promptLink: t.promptLink, linkSave: t.save, no: t.askCancel, linkTitle: t.tbLink })
})

const held = (k: string): unknown =>
  JSON.parse(root.querySelector<HTMLInputElement>(`[data-k="${k}"]`)?.value ?? 'null')

const press = (hook: string, nth = 0): void => {
  const keys = root.querySelectorAll<HTMLElement>(`[${hook}]`)
  keys[nth]?.dispatchEvent(new Event('click', { bubbles: true }))
}

describe('the header menu', () => {
  it('ships with the stored rows in one field, not one field per row', () => {
    expect(held('menu')).toEqual(settings.menu)
    // The per-row fields are gone: a `data-k` on a row is what made editing one link wipe the
    // whole menu, and what made a removal unsendable.
    expect(root.querySelector('[data-k="menu.0.label"]')).toBeNull()
  })

  it('adds a row, and the new row stores nothing until it is filled in', () => {
    press('data-menu-add')
    expect(root.querySelectorAll('[data-menu-row]').length).toBe(3)
    expect(held('menu')).toEqual([...settings.menu, { label: '', href: '' }])
  })

  it('removes a row, and the field says so', () => {
    press('data-menu-remove', 0)
    expect(held('menu')).toEqual([{ label: 'About', href: '/about' }])
  })

  it('follows a typed link into the field', () => {
    const box = root.querySelectorAll<HTMLInputElement>('[data-menu-href]')[1]!
    box.value = '/about-us'
    box.dispatchEvent(new Event('input', { bubbles: true }))
    expect(held('menu')).toEqual([{ label: 'Home', href: '/' }, { label: 'About', href: '/about-us' }])
  })
})

describe('the featured posts', () => {
  it('moves one down, and the order in the field follows', () => {
    press('data-featured-down', 0)
    expect(held('featured')).toEqual(['two', 'one'])
  })

  it('will not move the first one up or the last one down', () => {
    const up = root.querySelectorAll<HTMLButtonElement>('[data-featured-up]')
    const down = root.querySelectorAll<HTMLButtonElement>('[data-featured-down]')
    expect(up[0]?.disabled).toBe(true)
    expect(down[down.length - 1]?.disabled).toBe(true)
  })

  it('removes one and offers it again', () => {
    press('data-featured-remove', 0)
    expect(held('featured')).toEqual(['two'])
    const pick = root.querySelector<HTMLSelectElement>('[data-featured-add]')!
    expect([...pick.options].find((o) => o.value === 'one')?.hidden).toBe(false)
  })

  it('adds one from the select, and stops offering it', () => {
    const pick = root.querySelector<HTMLSelectElement>('[data-featured-add]')!
    pick.value = 'three'
    pick.dispatchEvent(new Event('change', { bubbles: true }))
    expect(held('featured')).toEqual(['one', 'two', 'three'])
    expect([...pick.options].find((o) => o.value === 'three')?.hidden).toBe(true)
    // And the select goes back to its own name, which is its first option.
    expect(pick.value).toBe('')
  })

  it('shows the empty line once the last one goes', () => {
    press('data-featured-remove', 0)
    press('data-featured-remove', 0)
    expect(held('featured')).toEqual([])
    expect(root.querySelector<HTMLElement>('[data-featured-none]')?.hidden).toBe(false)
  })
})

describe('the front page\'s category rows', () => {
  it('keeps each row\'s own count and columns in the field', () => {
    expect(held('home.front.strips')).toEqual([{ category: 'essays', count: 6, columns: 2 }])
  })

  it('adds a row seeded the way the renderer expects', () => {
    const pick = root.querySelector<HTMLSelectElement>('[data-strip-add]')!
    pick.value = 'notes'
    pick.dispatchEvent(new Event('change', { bubbles: true }))
    expect(held('home.front.strips')).toEqual([
      { category: 'essays', count: 6, columns: 2 },
      { category: 'notes', count: 3, columns: 3 },
    ])
  })

  it('follows the count as it is typed', () => {
    const box = root.querySelector<HTMLInputElement>('[data-strip-count]')!
    box.value = '9'
    box.dispatchEvent(new Event('input', { bubbles: true }))
    expect(held('home.front.strips')).toEqual([{ category: 'essays', count: 9, columns: 2 }])
  })

  it('removes a row and offers its category again', () => {
    press('data-strip-remove', 0)
    expect(held('home.front.strips')).toEqual([])
    const pick = root.querySelector<HTMLSelectElement>('[data-strip-add]')!
    expect([...pick.options].find((o) => o.value === 'essays')?.hidden).toBe(false)
  })
})

describe('the footer toolbar', () => {
  const area = (): HTMLTextAreaElement => root.querySelector<HTMLTextAreaElement>('[data-footer-field]')!

  it('wraps the selection and keeps it selected', () => {
    const box = area()
    box.setSelectionRange(7, 11) // "in **" … the word `in` is at 4; pick "Souv"
    const before = box.value
    press('data-footer-wrap', 0)
    expect(box.value).not.toBe(before)
    expect(box.value.slice(box.selectionStart, box.selectionEnd)).toBe(before.slice(7, 11))
  })

  it('redraws the preview from the same renderer the server used', () => {
    const box = area()
    box.value = 'A **bold** word'
    box.dispatchEvent(new Event('input', { bubbles: true }))
    expect(root.querySelector('[data-footer-preview]')?.innerHTML).toContain('<strong>bold</strong>')
  })
})
