// One panel, three kinds — and this file is the list of what differs.
//
// The three React panels it replaces were near-identical and had drifted twice in ways nothing
// caught: a note's publish date was moved by a crash-recovery restore, and a page's panel was
// modal on a screen with room to stand beside the writing. Both were found by reading the three
// side by side, which is a thing that happens once. This is the same reading, kept.
import { describe, expect, it } from 'bun:test'
import { adminT } from '@/i18n/admin-i18n'
import { sheetPanel, type PanelPiece, type SheetKind } from './sheet-panel'

const t = adminT('en')
const LISTS = {
  categories: ['Type', 'Tools'], tags: ['ink', 'paper'], series: ['A history'],
  groups: ['thu-gui-me'],
}

const piece = (kind: SheetKind, over: Partial<PanelPiece> = {}): PanelPiece => ({
  kind,
  slug: 'a-piece', title: 'A piece', status: 'draft',
  date: kind === 'page' ? '' : '2027-03-04T09:30',
  categories: [], tags: [], series: '', seriesOrder: 0,
  featuredImage: '', coverImage: '', metaTitle: '', metaDescription: '', excerpt: '',
  sourceUrl: '', sourceTitle: '', quote: '', scheduledNote: '',
  lang: '', translationGroup: '', translations: '',
  ...over,
})

const draw = (kind: SheetKind, over: Partial<PanelPiece> = {}): string =>
  sheetPanel({ t, lang: 'en', piece: piece(kind, over), lists: LISTS, headerRight: '', bottom: '' })

describe('what every kind has', () => {
  for (const kind of ['post', 'page', 'note'] as const) {
    it(`gives a ${kind} its slug and its status`, () => {
      const html = draw(kind)
      expect(html).toContain('data-k="slug"')
      expect(html).toContain('data-k="status"')
      expect(html).toContain('value="draft" data-k="status"')
      expect(html).toContain('value="published"')
    })
  }
})

describe('what only a post has', () => {
  const html = draw('post')
  it('has the terms, the series, both pictures, the excerpt and the SEO pair', () => {
    for (const hook of [
      'data-chips="categories"', 'data-chips="tags"', 'data-pick="series"',
      'data-picture="featuredImage"', 'data-picture="coverImage"',
      'data-k="excerpt"', 'data-k="metaTitle"', 'data-k="metaDescription"',
    ]) expect(html).toContain(hook)
  })

  it('offers every term not already chosen, with no cap', () => {
    // The editor must show them all: a taxonomy the writer cannot see is one they re-create by
    // typing a near-miss of a category that already exists.
    expect(html).toContain('data-chip-add="Type"')
    expect(html).toContain('data-chip-add="Tools"')
    const chosen = draw('post', { categories: ['Type'] })
    expect(chosen).toContain('data-chip="Type"')
    expect(chosen).not.toContain('data-chip-add="Type"')
    expect(chosen).toContain('data-chip-add="Tools"')
  })

  it('draws the series order and hides it until there is a series', () => {
    expect(html).toContain('<div data-series-order hidden>')
    expect(draw('post', { series: 'A history' })).toContain('<div data-series-order>')
  })
})

describe('what only a note has', () => {
  const html = draw('note')
  it('has the three source fields and no terms', () => {
    expect(html).toContain('data-k="sourceUrl"')
    expect(html).toContain('data-k="sourceTitle"')
    expect(html).toContain('data-k="quote"')
    expect(html).not.toContain('data-chips=')
    expect(html).not.toContain('data-picture=')
  })
})

describe('what a page does NOT have', () => {
  const html = draw('page')
  it('has no date, because a page is not in the archive and nothing waits for it', () => {
    expect(html).not.toContain('data-date="date"')
    expect(html).not.toContain('data-k="date"')
  })

  it('has its featured picture and nothing else from the post', () => {
    expect(html).toContain('data-picture="featuredImage"')
    expect(html).not.toContain('data-picture="coverImage"')
    expect(html).not.toContain('data-chips=')
    expect(html).not.toContain('data-k="excerpt"')
    expect(html).not.toContain('data-k="sourceUrl"')
  })
})

describe('a date that can be typed', () => {
  it('is a field, in the language\'s own order, on the two kinds that have one', () => {
    for (const kind of ['post', 'note'] as const) {
      const html = draw(kind)
      expect(html).toContain('data-date-box')
      // English admin: month first. `date-typing.test.ts` holds the other ten.
      expect(html).toContain('placeholder="mm/dd/yyyy hh:mm"')
      expect(html).toContain('value="03/04/2027 09:30"')
    }
  })

  it('ships the scheduled line hidden, so it does not move the fields under it when it arrives', () => {
    // The HOOK and the attribute, not the class list: what has to hold is that the line ships
    // and ships hidden. Its grey is the designer's business and pinning it here would make a
    // restyle look like a regression.
    expect(draw('post')).toMatch(/data-date-note class="[^"]*" hidden/)
    expect(draw('post', { scheduledNote: 'Scheduled for later' })).toContain('>Scheduled for later<')
  })
})

describe('both states of a picture ship', () => {
  it('draws the slot full and empty, and hides the one that does not apply', () => {
    const empty = draw('post')
    expect(empty).toContain('data-picture-shot src="" alt="" class="aspect-video w-full rounded-lg object-cover" hidden')
    expect(empty).toContain('data-picture-empty')
    expect(empty).toContain('data-picture-drop')

    const full = draw('post', { featuredImage: '/uploads/media/a.jpg' })
    expect(full).toContain('src="/uploads/media/a.jpg"')
    // The empty well is still in the markup, hidden — the island never builds a control.
    expect(full).toContain('data-picture-empty')
  })
})

describe('the panel itself', () => {
  const html = draw('post')
  it('ships shut, with the scrim and the publish key shut with it', () => {
    expect(html).toContain('data-sheet-panel hidden')
    expect(html).toContain('data-panel-scrim hidden')
    expect(html).toContain('data-panel-publish hidden')
    expect(html).toContain('data-panel-intro hidden')
  })

  it('carries both wordings for the controls that change what they say', () => {
    // The panel is the attributes on one visit and the publish step on the next, and the island
    // must not hold a second copy of eleven languages to say so.
    expect(html).toContain('data-say-attributes="Attributes"')
    expect(html).toContain('data-say-later=')
    expect(html).toContain('data-say-hide=')
  })

  it('does not claim to be modal in the markup', () => {
    // It is modal only when it is NOT docked, and whether it docks is a question about the
    // window. A server that guesses tells a screen reader the page has gone when it has not.
    expect(html).not.toContain('aria-modal')
  })
})
