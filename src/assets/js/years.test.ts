// The year index island, and the drawer's focus on a touch, against a real DOM.
import { beforeEach, describe, expect, it } from 'bun:test'
import { rail } from './theme'
import { yearIndex } from './years'
import { page, useDom } from './test-dom'

useDom()

const rows = () => [...document.querySelectorAll<HTMLAnchorElement>('a[data-year]')]
const frame = () => new Promise((r) => requestAnimationFrame(r))

const INDEX = `<aside class="rail rail-aside"><div class="rail-inner"><ul>
<li><a href="/archive#y2025" data-year="2025">2025</a></li>
<li><a href="/archive#y2023" data-year="2023">2023</a></li>
<li><a href="/archive#y2020" data-year="2020">2020</a></li></ul></div></aside>`

describe('the year index', () => {
  it('points a year at its first post on the page, and leaves one that is not there on the archive', () => {
    page(`${INDEX}<article data-yr="2025">a</article><article>b</article><article data-yr="2023">c</article>`, {})
    yearIndex()
    const [y25, y23, y20] = rows()
    expect(y25!.getAttribute('href')).toBe('#y2025')
    expect(y23!.getAttribute('href')).toBe('#y2023')
    expect(document.getElementById('y2025')?.textContent).toBe('a')
    expect(y20!.getAttribute('href')).toBe('/archive#y2020')
  })

  it('lights the year whose first post has passed the line, and only that one', async () => {
    page(`${INDEX}<article data-yr="2025">a</article><article data-yr="2023">c</article>`, {})
    const [a, c] = [...document.querySelectorAll<HTMLElement>('[data-yr]')]
    Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true })
    const at = (el: HTMLElement, top: number) => { el.getBoundingClientRect = () => ({ top } as DOMRect) }
    at(a!, -400); at(c!, 1200)
    yearIndex()
    expect(rows().map((r) => r.getAttribute('aria-current'))).toEqual(['location', null, null])
    at(c!, 100) // the 2023 post is now above the line
    window.dispatchEvent(new Event('scroll'))
    await frame()
    expect(rows().map((r) => r.getAttribute('aria-current'))).toEqual([null, 'location', null])
  })

  it('does nothing on a page with no index', () => {
    page('<article data-yr="2025">a</article>', {})
    yearIndex()
    expect(document.getElementById('y2025')).toBeNull()
  })
})

describe('the drawer', () => {
  // The previous test leaves the drawer open on <html>; a page starts shut.
  beforeEach(() => { delete document.documentElement.dataset.rail })
  const DRAWER = `<button data-rail-toggle aria-label="Menu"></button>
<aside class="rail rail-main"><div class="rail-search"><form><input name="q"></form></div>
<div class="rail-inner"><a href="/a">A</a><a href="/b">B</a></div></aside>
<aside class="rail rail-aside"><div class="rail-inner"><a href="/c">C</a></div></aside>`

  it('is the rail before the right-hand one, and a touch focuses the drawer, not its first link', () => {
    page(DRAWER, {})
    rail()
    const button = document.querySelector<HTMLButtonElement>('[data-rail-toggle]')!
    button.dispatchEvent(new MouseEvent('click', { detail: 1, bubbles: true }))
    const drawer = document.querySelector<HTMLElement>('.rail-main')!
    expect(document.documentElement.dataset.rail).toBe('open')
    expect(drawer.getAttribute('role')).toBe('dialog')
    expect(document.querySelector('.rail-aside')!.getAttribute('role')).toBeNull()
    expect(document.activeElement).toBe(drawer)
  })

  it('puts a key press on the first control, which is the search box', () => {
    page(DRAWER, {})
    rail()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    document.querySelector<HTMLButtonElement>('[data-rail-toggle]')!
      .dispatchEvent(new MouseEvent('click', { detail: 0, bubbles: true }))
    expect(document.activeElement?.getAttribute('name')).toBe('q')
  })

  it('does not take a click with no key before it (a screen reader\'s) for a key press', () => {
    page(DRAWER, {})
    rail()
    document.querySelector<HTMLButtonElement>('[data-rail-toggle]')!
      .dispatchEvent(new MouseEvent('click', { detail: 0, bubbles: true }))
    expect(document.activeElement).toBe(document.querySelector('.rail-main'))
  })
})
