// THE WRITE COLUMN'S NARROWING, over the markup the server actually sends.
//
// Four questions stack into one — kind, status, what a piece is missing, and the words typed —
// and the whole of it runs on rows that are already in the page (`docs/admin-one-dom.md`, trap
// 2). That makes it fast and it makes it quiet: a filter that hides the wrong rows draws a list
// that looks entirely plausible, and there is no request to inspect and no error to read.
//
// ⚠️ AND THE COUNT IS PART OF IT. The first cut left three of the four filters to CSS rules and
// kept only the search here, which drew correctly and could not COUNT — so a filter that hid
// every row still reported every row and the "nothing matches your filter" line never appeared.
// It was found by photographing this build beside the React one it replaces. These tests are so
// that the next one does not need a photograph.
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { adminT } from '@/i18n/admin-i18n'
import { writePane } from '@/web/admin/screens/content-pane'
import type { WriteItem } from '@/web/admin/screens/content-items'
import { applyAll, keepStanding, paintMarks, pieces, showHits, sortBy } from './lib/write-filter'
import { WRITE_PAGE } from '@/admin-shared/write'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const t = adminT('en')
const DAY = 86_400_000
const NOW = new Date(2026, 8, 15, 10, 0).getTime()

const piece = (over: Partial<WriteItem> & Pick<WriteItem, 'kind' | 'slug'>): WriteItem => ({
  title: over.slug, status: 'published', touched: NOW, created: NOW,
  standing: '', terms: '', editHref: `/admin/editor/${over.slug}`,
  noExcerpt: false, noImage: false, ...over,
})

const ITEMS: WriteItem[] = [
  piece({ kind: 'post', slug: 'kerning', title: 'Kerning and the eye', touched: NOW, created: NOW - DAY * 9, terms: 'type craft' }),
  piece({ kind: 'post', slug: 'ligatures', title: 'Ligatures', status: 'draft', touched: NOW - DAY, created: NOW - DAY }),
  piece({ kind: 'post', slug: 'bare', title: 'A post with no share image', noImage: true, touched: NOW - DAY * 2, created: NOW - DAY * 20 }),
  piece({ kind: 'post', slug: 'thin', title: 'A post with no excerpt', noExcerpt: true, touched: NOW - DAY * 3, created: NOW - DAY * 3 }),
  piece({ kind: 'page', slug: 'about', title: 'About', standing: '/about', touched: NOW - DAY * 4, created: NOW - DAY * 4 }),
  // Vietnamese, because the search folds accents and the admin is written in eleven languages.
  piece({ kind: 'note', slug: 'be-rong', title: 'Bề rộng của cột', touched: NOW - DAY * 5, created: NOW - DAY * 5 }),
]

let root: HTMLElement
let pane: HTMLElement

const draw = (items: WriteItem[] = ITEMS, needs: 'excerpt' | 'image' | null = null): void => {
  root.innerHTML = writePane({
    t, lang: 'en', items, views: {}, needs, openKey: '', alone: true, now: NOW,
  })
  pane = root.querySelector<HTMLElement>('[data-write-pane]')!
}

beforeEach(() => {
  document.body.innerHTML = ''
  root = document.createElement('div')
  document.body.appendChild(root)
  draw()
})

const ask = (over: Partial<Parameters<typeof applyAll>[1]> = {}) =>
  applyAll(pieces(pane), { needle: '', kind: 'all', state: 'all', needs: '', hits: null, ...over })

const showing = (): string[] => [...pane.querySelectorAll<HTMLElement>('[data-piece]')]
  .filter((el) => !el.hidden).map((el) => el.dataset.piece ?? '')

describe('one question at a time', () => {
  it('shows everything when nothing is asked', () => {
    expect(ask()).toBe(ITEMS.length)
    expect(showing().length).toBe(ITEMS.length)
  })

  it('narrows to one kind', () => {
    expect(ask({ kind: 'page' })).toBe(1)
    expect(showing()).toEqual(['page:about'])
  })

  it('narrows to drafts, and a scheduled post is NOT one', () => {
    // A scheduled post's status IS `published` — the lamp pulses and that is the only place the
    // difference is said out loud. Asking for drafts must not hand back things nobody can edit
    // into, and must not hide a post that is simply dated ahead.
    expect(ask({ state: 'draft' })).toBe(1)
    expect(showing()).toEqual(['post:ligatures'])
  })

  it('narrows to what a piece is missing', () => {
    expect(ask({ needs: 'image' })).toBe(1)
    expect(showing()).toEqual(['post:bare'])
    expect(ask({ needs: 'excerpt' })).toBe(1)
    expect(showing()).toEqual(['post:thin'])
  })

  it('finds a title by its words', () => {
    expect(ask({ needle: 'kerning' })).toBe(1)
    expect(showing()).toEqual(['post:kerning'])
  })

  it("finds a post by one of its terms, which is not in the title", () => {
    expect(ask({ needle: 'craft' })).toBe(1)
    expect(showing()).toEqual(['post:kerning'])
  })

  it('finds Vietnamese typed without its tones', () => {
    // "be rong" for "Bề rộng" is what people actually do, and it is faster than reaching for
    // tone marks. A blog written in Vietnamese whose search box needs them is a search box.
    expect(ask({ needle: 'be rong' })).toBe(1)
    expect(showing()).toEqual(['note:be-rong'])
  })

  it('takes a body hit for a row whose title says nothing', () => {
    const hits = new Map([['page:about', 'a line from the body']])
    expect(ask({ needle: 'zzz', hits })).toBe(1)
    expect(showing()).toEqual(['page:about'])
  })
})

describe('the four stack', () => {
  it('answers "drafts of posts" as one question', () => {
    expect(ask({ kind: 'post', state: 'draft' })).toBe(1)
    expect(showing()).toEqual(['post:ligatures'])
  })

  it('answers "pages that are drafts" with nothing, and says so', () => {
    expect(ask({ kind: 'page', state: 'draft' })).toBe(0)
    expect(showing()).toEqual([])
  })

  it('keeps the needs filter when a kind is chosen on top of it', () => {
    // Somebody who arrives on "no share image" and then presses Posts is asking a NARROWER
    // question, not starting again.
    expect(ask({ needs: 'image', kind: 'post' })).toBe(1)
    expect(ask({ needs: 'image', kind: 'page' })).toBe(0)
  })
})

describe('the server draws the address filter itself', () => {
  it('hides the rows that do not match before anything runs', () => {
    draw(ITEMS, 'image')
    expect(showing()).toEqual(['post:bare'])
  })

  it('says nothing matches, in the first frame, when nothing does', () => {
    draw(ITEMS.filter((i) => !i.noExcerpt), 'excerpt')
    expect(pane.querySelector<HTMLElement>('[data-write-none]')?.hidden).toBe(false)
    expect(pane.querySelector<HTMLElement>('[data-write-list]')?.hidden).toBe(true)
  })
})

describe('the matched words are painted', () => {
  it('wraps the run in a mark, and puts the text back when the box is cleared', () => {
    const row = pane.querySelector<HTMLElement>('[data-piece="post:kerning"]')!
    paintMarks(row, 'kerning')
    expect(row.querySelector('mark')?.textContent).toBe('Kerning')
    paintMarks(row, '')
    expect(row.querySelector('mark')).toBeNull()
    expect(row.querySelector('.write-title')?.textContent).toBe('Kerning and the eye')
  })

  it('marks an accented title from an unaccented query', () => {
    const row = pane.querySelector<HTMLElement>('[data-piece="note:be-rong"]')!
    paintMarks(row, 'be rong')
    expect(row.querySelector('mark')?.textContent).toBe('Bề rộng')
  })

  it('builds the mark as a NODE, so a title can never be markup', () => {
    // Every title on this screen came from outside, so a highlighter that assembled a string
    // would be an injection on the one screen where that is guaranteed to matter.
    draw([piece({ kind: 'post', slug: 'x', title: '<img src=x onerror=1> hello' })])
    const row = pane.querySelector<HTMLElement>('[data-piece="post:x"]')!
    paintMarks(row, 'hello')
    expect(row.querySelector('img')).toBeNull()
    expect(row.querySelector('mark')?.textContent).toBe('hello')
  })
})

describe('the summary line', () => {
  it('shows the matched passage while searching and the standing line after', () => {
    const list = pieces(pane)
    keepStanding(list)
    const row = pane.querySelector<HTMLElement>('[data-piece="page:about"]')!
    expect(row.querySelector('[data-write-line]')?.textContent).toBe('/about')
    showHits(list, new Map([['page:about', 'found in the body']]))
    expect(row.querySelector('[data-write-line]')?.textContent).toBe('found in the body')
    showHits(list, null)
    expect(row.querySelector('[data-write-line]')?.textContent).toBe('/about')
  })
})

describe('the sort moves the rows it already has', () => {
  it('reorders by the other date without rebuilding anything', () => {
    const list = pieces(pane)
    const box = pane.querySelector<HTMLElement>('[data-write-list]')!
    const before = [...box.querySelectorAll('[data-piece]')]
    sortBy(box, list, 'created')
    const after = [...box.querySelectorAll('[data-piece]')]
    // The same NODES, in a different order: a row rebuilt here would be a second copy of the
    // server's markup, and it would lose every listener the island has put on it.
    expect(after.length).toBe(before.length)
    expect(new Set(after)).toEqual(new Set(before))
    // By `created`, not by `touched`: the newest publication date is the draft from yesterday,
    // and the oldest is the post published twenty days ago and edited two days ago. Sorting by
    // the wrong one of the two dates is exactly the fault that reads as plausible.
    expect((after[0] as HTMLElement).dataset.piece).toBe('post:ligatures')
    expect((after.at(-1) as HTMLElement).dataset.piece).toBe('post:bare')
    sortBy(box, list, 'updated')
    expect([...box.querySelectorAll('[data-piece]')].map((e) => (e as HTMLElement).dataset.piece))
      .toEqual(before.map((e) => (e as HTMLElement).dataset.piece))
  })
})

/**
 * ⚠️ THE COLUMN SHOWS A PAGE AT A TIME, and the count must not follow it.
 *
 * A blog with two thousand pieces drew two thousand rows, and the browser laid out and painted
 * every one of them before the owner could read the first. So the server draws the first page
 * and hides the rest, and the island reveals another page each time the foot of the list comes
 * into view (`admin-shared/write.ts`).
 *
 * The trap this pins is the one the file's own comment describes: a row is hidden for exactly
 * ONE reason. The reveal had to go inside that single decision rather than beside it, and the
 * number that comes back has to stay "how many answer the question" — it is what decides
 * whether the column says nothing matched, and that sentence must not depend on how far
 * somebody has scrolled.
 */
describe('a page at a time', () => {
  const askTo = (limit: number, over: Partial<Parameters<typeof applyAll>[1]> = {}) =>
    applyAll(pieces(pane), { needle: '', kind: 'all', state: 'all', needs: '', hits: null, ...over }, limit)

  it('reveals only the first page but counts every match', () => {
    expect(askTo(2)).toBe(ITEMS.length)
    expect(showing().length).toBe(2)
  })

  it('reveals the page in the order the rows are IN, not the order they were written', () => {
    expect(askTo(3)).toBe(ITEMS.length)
    expect(showing()).toEqual(['post:kerning', 'post:ligatures', 'post:bare'])
  })

  it('pages what MATCHES, so a narrowed list starts again at its own top', () => {
    // Four posts, two revealed: the pages are of the answer, not of the whole column.
    expect(askTo(2, { kind: 'post' })).toBe(4)
    expect(showing()).toEqual(['post:kerning', 'post:ligatures'])
  })

  it('a bigger limit than there are rows changes nothing', () => {
    expect(askTo(9_999)).toBe(ITEMS.length)
    expect(showing().length).toBe(ITEMS.length)
  })

  /**
   * The server draws the first page hidden-past-the-line and the island takes it from there.
   * If these two numbers ever disagree the column either flashes a thousand rows on load or
   * stops one page short of the end with no way to ask for more.
   */
  it('arrives with one page showing and a foot to watch', () => {
    const many = Array.from({ length: WRITE_PAGE + 12 }, (_, i) =>
      piece({ kind: 'post', slug: `p${i}`, title: `Post ${i}`, touched: NOW - i, created: NOW - i }))
    draw(many)
    expect(showing().length).toBe(WRITE_PAGE)
    expect(pane.querySelector<HTMLElement>('[data-write-more]')?.hidden).toBe(false)
    // And a short column has no foot at all, so nothing is watching for a page that cannot come.
    draw()
    expect(pane.querySelector<HTMLElement>('[data-write-more]')?.hidden).toBe(true)
  })

  /**
   * ⚠️ AND THE SORT HAS TO MOVE THE ARRAY WITH THE NODES. It used to sort a copy, which was
   * invisible while every match was on screen and stops being invisible the moment only the
   * first page is: the reveal would have shown the first rows of the OLD order while the reader
   * was looking at the new one.
   */
  it('keeps the array in step with the DOM when the order changes', () => {
    const list = pieces(pane)
    const box = pane.querySelector<HTMLElement>('[data-write-list]')!
    sortBy(box, list, 'created')
    const inDom = [...box.querySelectorAll<HTMLElement>('[data-piece]')].map((el) => el.dataset.piece ?? '')
    expect(list.map((p) => p.key)).toEqual(inDom)
    // And the first page is now the first of the NEW order.
    applyAll(list, { needle: '', kind: 'all', state: 'all', needs: '', hits: null }, 1)
    expect(showing()).toEqual([inDom[0] ?? ''])
  })
})
