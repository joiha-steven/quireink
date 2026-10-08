import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { arrangeRows, rankMatch, rankRows } from './palette-rank'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

// The list as the palette draws it: headings, a recent slot, then three groups of rows.
const ROWS: [string, string, string][] = [
  ['action', 'Clear cache', 'Clear cache'],
  ['screen', 'Activity log', 'Activity log who signed in, what was uploaded or published'],
  ['screen', 'Media', 'Media uploads and images'],
  ['screen', 'Newsletter', 'Newsletter'],
  ['setting', 'Notifications', 'Notifications send me news when a comment arrives'],
  ['setting', 'Site news', 'Site news'],
  ['setting', 'Audit trail', 'Audit trail every upload is recorded'],
  ['setting', 'Largest upload (MB)', 'Largest upload (MB) Server'],
  ['setting', 'Theme', 'Theme light dark'],
  ['setting', 'Look', 'Look the theme of the public pages'],
  ['setting', 'Trash', 'Trash'],
  ['setting', 'Empty trash', 'Empty trash delete forever'],
  ['setting', 'Retention', 'Retention how long trash is kept'],
]
let list: HTMLElement
const all = (): HTMLElement[] => [...list.querySelectorAll<HTMLElement>('[data-pal-row]')]
const shown = (q: string): string[] => {
  const rows = all()
  const ranks = rankRows(rows, q)
  arrangeRows(rows, ranks)
  return all().filter((r) => ranks.get(r) !== -1).map((r) => r.firstElementChild!.textContent!)
}

beforeEach(() => {
  list = document.createElement('ul')
  list.innerHTML = '<li data-pal-head="recent"></li><span data-pal-recent>'
    + '<li data-pal-row data-pal-group="recent" data-pal-search="Trash"><span>Trash</span></li></span>'
    + ROWS.map(([g, title, search]) =>
      `<li data-pal-row data-pal-group="${g}" data-pal-search="${search}"><span>${title}</span></li>`).join('')
  document.body.replaceChildren(list)
})

describe('the palette ranks a hit in the title above a hit in the description', () => {
  test('upload: the title hit first, the log (description) after', () => {
    // Screens first (their own group), then settings, where the title hit beats the earlier row.
    expect(shown('upload')).toEqual(['Activity log', 'Media', 'Largest upload (MB)', 'Audit trail'])
  })
  test('news: starts-with, then word-start, then description', () => {
    expect(shown('news')).toEqual(['Newsletter', 'Site news', 'Notifications'])
  })
  test('theme: the Theme row before the Look row that only describes it', () => {
    expect(shown('theme')).toEqual(['Theme', 'Look'])
  })
  test('trash: prefix, word start, description; equal ranks keep drawn order', () => {
    expect(shown('trash').filter((t, i, a) => a.indexOf(t) === i)).toEqual(['Trash', 'Empty trash', 'Retention'])
  })
  test('the order only changes inside a group, and the recent slot is untouched', () => {
    shown('news')
    const groups = all().map((r) => r.dataset.palGroup)
    expect(groups).toEqual(['recent', 'action', 'screen', 'screen', 'screen', 'setting', 'setting', 'setting', 'setting', 'setting', 'setting', 'setting', 'setting', 'setting'])
    expect(all()[0]!.firstElementChild!.textContent).toBe('Trash')
    expect(list.children[1]!.tagName).toBe('SPAN')
  })
  test('an empty query puts every row back where it was drawn', () => {
    const drawnOrder = all().map((r) => r.firstElementChild!.textContent)
    shown('upload')
    arrangeRows(all(), null)
    expect(all().map((r) => r.firstElementChild!.textContent)).toEqual(drawnOrder)
  })
  test('tiers: prefix 0, word start 1, inside a word 2, description 3, none -1', () => {
    expect(rankMatch('Newsletter', 'x', 'news')).toBe(0)
    expect(rankMatch('Site news', 'x', 'news')).toBe(1)
    expect(rankMatch('Newsletters', 'x', 'letter')).toBe(2)
    expect(rankMatch('Look', 'the theme', 'theme')).toBe(3)
    expect(rankMatch('Look', 'the theme', 'zzz')).toBe(-1)
  })
  test('an unaccented query finds an accented title', () => {
    expect(rankMatch('Bình luận', 'x', 'binh')).toBe(0)
  })
})
