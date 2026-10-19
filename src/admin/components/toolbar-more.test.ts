// The toolbar's "More" key, end to end in a DOM: what the row hides, what the menu lists, and
// the keyboard contract of a menu button. The widths are stubbed (happy-dom lays nothing out):
// keys 36px, a 600px strip, no gaps, so the row keeps three clusters and More holds the
// shapes and the inserts, nine keys.
//
// happy-dom is registered for THIS FILE ONLY and unregistered afterwards.
import { describe, expect, it, beforeAll, afterAll, afterEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

type Mounted = {
  host: HTMLElement
  destroy: () => void
  editorHtml: () => string
  /** The window changed: a new strip width (and More's right edge), then what the observer does. */
  refit: (room: number, moreRight?: number) => void
}
let mounted: Mounted | null = null
afterEach(() => { mounted?.destroy(); mounted = null; document.head.replaceChildren() })

/**
 * Mount a bar in a strip `room` px wide, with every key (and More) 36px wide. `strip` is the
 * strip's `overflow-x`: `visible` is the desktop's row, `auto` the phone's scrolling one.
 * `scrollbar` takes 17px off the strip while every key is on the row and the row is wider than
 * the strip, which is what a classic page scrollbar raised by that overflow does.
 */
async function mount(
  room: number, content = 'x', strip: 'visible' | 'auto' = 'visible', scrollbar = false,
): Promise<Mounted> {
  const style = document.createElement('style')
  style.textContent = `.scroll-fade-x { overflow-x: ${strip} }`
  document.head.appendChild(style)
  const { Editor } = await import('@/admin/editor/editor')
  const { mountToolbar, toolbarWords } = await import('@/admin/components/editor-toolbar')
  const { adminT } = await import('@/i18n/admin-i18n')
  const editor = new Editor({ element: document.createElement('div'), content })
  const host = document.createElement('div')
  document.body.appendChild(host)

  let width = room
  let moreRight = 0
  const box = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
  const rect = HTMLElement.prototype.getBoundingClientRect
  const Observer = globalThis.ResizeObserver
  // happy-dom never calls an observer back, so the test plays the browser and calls it.
  const observers: (() => void)[] = []
  globalThis.ResizeObserver = class {
    constructor(callback: () => void) { observers.push(callback) }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
  // The strip is the element wearing `scroll-fade-x`; a key is the tooltip's wrapper around it.
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get(this: HTMLElement) {
      if (!this.classList.contains('scroll-fade-x')) return 0
      const keys = [...this.querySelectorAll<HTMLElement>('[data-toolbar-cluster] button')]
      const full = keys.length > 0 && keys.every(visible) && keys.length * 36 > width
      return scrollbar && full ? width - 17 : width
    },
  })
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    const isMore = this.hasAttribute('data-toolbar-more')
    const w = this.classList.contains('inline-flex') && this.querySelector('button') ? 36 : 0
    const right = isMore ? moreRight : w
    return { x: 0, y: 0, left: right - w, top: 0, right, bottom: 36, width: w, height: 36, toJSON: () => ({}) } as DOMRect
  }
  const restore = (): void => {
    if (box) Object.defineProperty(HTMLElement.prototype, 'clientWidth', box)
    HTMLElement.prototype.getBoundingClientRect = rect
    globalThis.ResizeObserver = Observer
  }
  try {
    const bar = mountToolbar(host, {
      editor, words: toolbarWords(adminT('en') as never), askLink: async () => null,
      onPickImage: () => {}, onPickGallery: () => {},
    })
    return {
      host,
      editorHtml: () => editor.getHTML(),
      refit: (next, right = moreRight) => {
        width = next
        moreRight = right
        for (const callback of observers) callback()
      },
      destroy: () => {
        bar.destroy()
        editor.destroy()
        host.remove()
        restore()
      },
    }
  } catch (error) {
    restore()
    throw error
  }
}

const more = (host: HTMLElement) => host.querySelector<HTMLButtonElement>('[data-toolbar-more]')!
const menu = (host: HTMLElement) => host.querySelector<HTMLElement>('[role="menu"]')!
const items = (host: HTMLElement) => [...menu(host).querySelectorAll<HTMLButtonElement>('button')]
const visible = (el: Element | null): boolean => {
  for (let at = el; at; at = at.parentElement) if ((at as HTMLElement).hidden) return false
  return true
}
const press = (target: Element, key: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))

describe('the row that fits', () => {
  it('shows every key and no More key when the strip has the room', async () => {
    mounted = await mount(2000)
    const { host } = mounted
    const keys = [...host.querySelectorAll('[data-toolbar-cluster] button')]
    expect(keys).toHaveLength(24)
    expect(keys.every(visible)).toBe(true)
    expect(visible(more(host))).toBe(false)
    expect(menu(host).hidden).toBe(true)
    expect(menu(host).children).toHaveLength(0)
  })

  it('leaves a strip that scrolls (the phone) whole, whatever its width', async () => {
    mounted = await mount(300, 'x', 'auto')
    const { host } = mounted
    expect([...host.querySelectorAll('[data-toolbar-cluster] button')].every(visible)).toBe(true)
    expect(visible(more(host))).toBe(false)
  })
})

describe('the row that does not fit', () => {
  it('hides whole clusters from the end and draws each key once', async () => {
    mounted = await mount(600)
    const { host } = mounted
    const clusters = [...host.querySelectorAll<HTMLElement>('[data-toolbar-cluster]')]
    expect(clusters.map((c) => !c.hidden)).toEqual([true, true, true, false, false])
    expect(visible(more(host))).toBe(true)
    // One DOM: the hidden keys are the row's own, and the menu holds nothing until it opens.
    expect(host.querySelectorAll('button[aria-label^="Bold"]')).toHaveLength(1)
    expect(menu(host).children).toHaveLength(0)
  })

  it('opens a menu of the hidden keys, by name and chord, focused on the first', async () => {
    mounted = await mount(600)
    const { host } = mounted
    more(host).click()
    expect(menu(host).hidden).toBe(false)
    expect(more(host).getAttribute('aria-expanded')).toBe('true')
    expect(more(host).getAttribute('aria-controls')).toBe(menu(host).id)
    const names = items(host).map((b) => b.querySelector('.truncate')!.textContent)
    expect(names).toEqual(['Quote', 'Code', 'Divider', 'Link', 'Image', 'Gallery', 'Table', 'Formula', 'Inline formula'])
    // The chord column prints what the row's tooltip prints, and nothing for a key without one.
    const link = items(host)[3]!
    expect(link.querySelector('.font-mono')?.textContent).toMatch(/K$/)
    expect(items(host)[2]!.querySelector('.font-mono')).toBeNull()
    expect(document.activeElement).toBe(items(host)[0]!)
  })

  it('walks with the arrows, wraps, and jumps with Home and End', async () => {
    mounted = await mount(600)
    const { host } = mounted
    more(host).click()
    const list = items(host)
    press(document.activeElement!, 'ArrowDown')
    expect(document.activeElement).toBe(list[1]!)
    press(document.activeElement!, 'ArrowUp')
    press(document.activeElement!, 'ArrowUp')
    expect(document.activeElement).toBe(list[list.length - 1]!)
    press(document.activeElement!, 'ArrowDown')
    expect(document.activeElement).toBe(list[0]!)
    press(document.activeElement!, 'End')
    expect(document.activeElement).toBe(list[list.length - 1]!)
    press(document.activeElement!, 'Home')
    expect(document.activeElement).toBe(list[0]!)
  })

  it('opens on ArrowUp at the last row, and on ArrowDown at the first', async () => {
    mounted = await mount(600)
    const { host } = mounted
    press(more(host), 'ArrowUp')
    expect(document.activeElement).toBe(items(host).at(-1)!)
    press(document.activeElement!, 'Escape')
    press(more(host), 'ArrowDown')
    expect(document.activeElement).toBe(items(host)[0]!)
  })

  it('gives the focus back to More on Escape, and the Escape goes no further', async () => {
    mounted = await mount(600)
    const { host } = mounted
    let reachedWindow = false
    const spy = (e: KeyboardEvent) => { if (e.key === 'Escape') reachedWindow = true }
    window.addEventListener('keydown', spy)
    more(host).click()
    press(document.activeElement!, 'Escape')
    window.removeEventListener('keydown', spy)
    expect(menu(host).hidden).toBe(true)
    expect(menu(host).children).toHaveLength(0)
    expect(document.activeElement).toBe(more(host))
    expect(more(host).getAttribute('aria-expanded')).toBe('false')
    // The attributes panel shuts on an Escape that reaches the window; this one was the menu's.
    expect(reachedWindow).toBe(false)
  })

  it('closes on Tab with the focus back on More, so Tab carries on from the row', async () => {
    mounted = await mount(600)
    const { host } = mounted
    more(host).click()
    press(document.activeElement!, 'Tab')
    expect(menu(host).hidden).toBe(true)
    expect(document.activeElement).toBe(more(host))
  })

  it('closes on a press outside it, and not on a press inside it', async () => {
    mounted = await mount(600)
    const { host } = mounted
    more(host).click()
    items(host)[1]!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(menu(host).hidden).toBe(false)
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(menu(host).hidden).toBe(true)
  })

  it('shows what is on: the block the caret is in reads as checked', async () => {
    mounted = await mount(600, '> quoted')
    const { host } = mounted
    more(host).click()
    const [quote, code, divider] = items(host)
    expect(quote!.getAttribute('role')).toBe('menuitemcheckbox')
    expect(quote!.getAttribute('aria-checked')).toBe('true')
    expect(code!.getAttribute('aria-checked')).toBe('false')
    // A key that cannot be pressed in does not claim a state at all.
    expect(divider!.getAttribute('role')).toBe('menuitem')
    expect(divider!.hasAttribute('aria-checked')).toBe(false)
  })

  it('runs the command it names and closes', async () => {
    mounted = await mount(600)
    const { host, editorHtml } = mounted
    more(host).click()
    const divider = items(host).find((b) => b.textContent?.includes('Divider'))!
    divider.click()
    expect(editorHtml()).toContain('<hr')
    expect(menu(host).hidden).toBe(true)
  })

  it('splits the first cluster only when nothing else fits beside More', async () => {
    mounted = await mount(150)
    const { host } = mounted
    const clusters = [...host.querySelectorAll<HTMLElement>('[data-toolbar-cluster]')]
    expect(clusters.map((c) => !c.hidden)).toEqual([true, false, false, false, false])
    const marks = [...clusters[0]!.querySelectorAll('button')].map(visible)
    // 150 = More (36) + three keys of 36: the first three marks stay, the rest of them go.
    expect(marks).toEqual([true, true, true, false, false, false])
    more(host).click()
    expect(items(host)).toHaveLength(21)
  })
})

describe('a fit while the menu is open, or while a key has the focus', () => {
  it('moves the open menu with More when the same keys stay behind it', async () => {
    mounted = await mount(600)
    const { host, refit } = mounted
    refit(600, 500)
    more(host).click()
    const before = menu(host).style.right
    // 620 still keeps three clusters (684 would be needed for four), but More has moved.
    refit(620, 540)
    expect(menu(host).hidden).toBe(false)
    expect(menu(host).style.right).not.toBe(before)
    expect(menu(host).style.right).toBe('-540px')
  })

  it('takes the menu down, focus on More, when what is behind More changes', async () => {
    mounted = await mount(600)
    const { host, refit } = mounted
    more(host).click()
    expect(document.activeElement).toBe(items(host)[0]!)
    refit(500)
    expect(menu(host).hidden).toBe(true)
    expect(document.activeElement).toBe(more(host))
  })

  it('hands the focus to More when the focused key is put behind it', async () => {
    mounted = await mount(2000)
    const { host, refit } = mounted
    const table = host.querySelector<HTMLButtonElement>('[data-toolbar-cluster] button[aria-label="Table"]')!
    table.focus()
    expect(document.activeElement).toBe(table)
    refit(600)
    expect(visible(table)).toBe(false)
    expect(document.activeElement).toBe(more(host))
  })

  it('hands the focus from More to the first key back when More goes', async () => {
    mounted = await mount(600)
    const { host, refit } = mounted
    more(host).focus()
    refit(2000)
    expect(visible(more(host))).toBe(false)
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^Quote/)
  })

  it('leaves the focus alone when the focused key stays on the row', async () => {
    mounted = await mount(2000)
    const { host, refit } = mounted
    const bold = host.querySelector<HTMLButtonElement>('button[aria-label^="Bold"]')!
    bold.focus()
    refit(600)
    expect(document.activeElement).toBe(bold)
  })

  it('reads the room before putting keys back, so a passing scrollbar costs no cluster', async () => {
    // Two clusters fit in 500. Widened to 690, four do (36 + 648 = 684): with every key put
    // back the row is 864 and overflows, and a strip read at that moment is 673, room for three.
    mounted = await mount(500, 'x', 'visible', true)
    const { host, refit } = mounted
    const shown = () => [...host.querySelectorAll<HTMLElement>('[data-toolbar-cluster]')].map((c) => !c.hidden)
    expect(shown()).toEqual([true, true, false, false, false])
    refit(690)
    expect(shown()).toEqual([true, true, true, true, false])
  })
})
