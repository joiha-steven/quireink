// The four settings CARDS, each asserted on the value the form will SEND rather than on the
// pixel it draws.
//
// Split from `SettingsView.mount.test.tsx` on 2026-08-29, when the Tables group put that file
// over the 400-line cap. That one keeps the screen's own mechanics; this one is the groups.
// The fixture and the helpers both use live in `settings-fixture.tsx` — see its header for
// why the settings object is hand-built rather than imported from the view module.
//
// Three of the four groups are here to prove an upgrade moved NOTHING: post pictures, shape
// and the author all arrived on a product with live blogs. Tables is the exception and is
// asserted as one — `head: 'tint'` is a chosen change, so the test pins the change.

import { describe, expect, it, beforeAll, afterAll, afterEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import {
  buttonInCard, fieldByLabel, onTab, releaseMocks, saved,
} from './settings-fixture'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())
afterEach(releaseMocks)

describe('post pictures (Layout)', () => {
  it('arrives with both choosers off, which is what an upgrade must look like', async () => {
    const { m, t } = await onTab('tabLayout')
    expect(m.text()).toContain(t.cardPostImage)
    // `aria-pressed` is the picker's own record of the selection, so this reads the control
    // rather than the state behind it: two `Not shown` buttons, both pressed.
    const off = [...m.container.querySelectorAll('button')]
      .filter((b) => b.textContent?.trim() === t.piOff)
    expect(off.length).toBe(2)
    expect(off.every((b) => b.getAttribute('aria-pressed') === 'true')).toBe(true)
    await m.unmount()
  })

  it('offers the hero TWO widths and no third — `wide` printed over the contents list', async () => {
    const { m, t } = await onTab('tabLayout')
    expect(m.button(t.piHeroInline)).toBeTruthy()
    // The row is the hero's chooser: its options are the two, and nothing else.
    const track = m.button(t.piHeroInline).parentElement
    expect([...(track?.children ?? [])].map((c) => c.textContent?.trim()))
      .toEqual([t.piOff, t.piHeroInline])
    await m.unmount()
  })

  it('turning the hero on sends hero: inline', async () => {
    const { m, t, fetchMock } = await onTab('tabLayout')
    await m.click(m.button(t.piHeroInline))
    const body = await saved(m, t, fetchMock)
    expect(body.postImage.hero).toBe('inline')
    expect(body.postImage.thumb).toBe('none') // the other half is untouched
    await m.unmount()
  })

  it('a thumbnail can sit beside the text or above the title', async () => {
    const { m, t, fetchMock } = await onTab('tabLayout')
    await m.click(m.button(t.piThumbTop))
    expect(await saved(m, t, fetchMock)).toHaveProperty('postImage.thumb', 'top')
    await m.click(m.button(t.piThumbSide))
    const body = await saved(m, t, fetchMock)
    expect(body.postImage.thumb).toBe('side')
    await m.unmount()
  })
})

describe('tables (Appearance)', () => {
  // The mirror image of the shape block below. `head: 'tint'` is the ONE default in this
  // product that deliberately does not reproduce what a blog looked like before the setting
  // existed, so the assertion is that the card opens ON the change rather than on the absence
  // of one — and that every other knob still opens on today.
  it('opens tinted, and on today for everything else', async () => {
    const { m, t } = await onTab('tabAppearance')
    expect(m.text()).toContain(t.cardTable)
    for (const label of [
      t.tableHeadTint, t.tableGridAll, t.tableHairline, t.tableColNormal, t.tableNarrowFit,
    ]) {
      expect(buttonInCard(m.container, t.cardTable, label).getAttribute('aria-pressed')).toBe('true')
    }
    await m.unmount()
  })

  it('sends the seven values it was left on', async () => {
    const { m, t, fetchMock } = await onTab('tabAppearance')
    // `buttonInCard`, not `m.button`: the padding words are the SHAPE card's on purpose, so
    // a bare lookup would find that card's copy of them first and this test would pass while
    // clicking the wrong control.
    for (const label of [
      t.tableHeadInk, t.tableGridRows, t.tableThick, t.tableColStrong,
      t.shapeRelaxed, t.tableNarrowScroll,
    ]) await m.click(buttonInCard(m.container, t.cardTable, label))
    const body = await saved(m, t, fetchMock)
    expect(body.table).toEqual({
      head: 'ink', grid: 'rows', ruleWeight: 'bold', stripe: false,
      firstColumn: 'strong', padding: 'roomy', narrow: 'scroll',
    })
    await m.unmount()
  })
})

describe('shape (Appearance)', () => {
  it('opens on the defaults that reproduce today exactly', async () => {
    const { m, t } = await onTab('tabAppearance')
    expect(m.text()).toContain(t.cardShape)
    for (const label of [t.shapeNormal, t.shapeSoft, t.shapeRegular]) {
      expect(m.button(label).getAttribute('aria-pressed')).toBe('true')
    }
    await m.unmount()
  })

  it('sends the three values it was left on, and only those', async () => {
    const { m, t, fetchMock } = await onTab('tabAppearance')
    await m.click(m.button(t.shapeRelaxed))
    await m.click(m.button(t.shapeRound))
    await m.click(m.button(t.shapeBold))
    const body = await saved(m, t, fetchMock)
    expect(body.shape).toEqual({ density: 'relaxed', radius: 'round', headingWeight: 'bold' })
    await m.unmount()
  })
})

describe('author (Site)', () => {
  it('starts empty — an existing blog has no byline and gains none', async () => {
    const { m, t } = await onTab('tabSite')
    expect(m.text()).toContain(t.cardAuthor)
    expect((fieldByLabel(m.container, t.authorName) as HTMLInputElement).value).toBe('')
    // No portrait, so the note stands in for the preview and no Remove is offered.
    expect(m.text()).toContain(t.authorNoAvatar)
    expect(() => m.button(t.removeSelection)).toThrow()
    await m.unmount()
  })

  it('sends the name, the bio and the link', async () => {
    const { m, t, fetchMock } = await onTab('tabSite')
    await m.type(fieldByLabel(m.container, t.authorName), 'Trần Mạnh Hùng')
    await m.type(fieldByLabel(m.container, t.authorBio), 'Writes about keyboards.')
    await m.type(fieldByLabel(m.container, t.authorLink), 'https://example.com/about')
    const body = await saved(m, t, fetchMock)
    expect(body.author).toEqual({
      name: 'Trần Mạnh Hùng',
      bio: 'Writes about keyboards.',
      // The PATH is kept: `sanitizeAuthor` deliberately does not use `sanitizeUrl`, which
      // would trim this back to the bare origin.
      url: 'https://example.com/about',
      avatarUrl: '',
    })
    await m.unmount()
  })

  it('the portrait opens the media library, the same picker the logo uses', async () => {
    const { m, t } = await onTab('tabSite')
    // Scoped to the Author CARD, not `m.button`, which returns the first match in the DOM.
    // The Site tab prints THREE `Choose image` buttons — favicon, app icon, portrait — and
    // this asserted the portrait's only for as long as Author happened to be rendered before
    // Branding. Moving Author into the other column on 2026-08-29 made it click the favicon,
    // which opens a file input rather than the library, and the test failed for a reason that
    // had nothing to do with what it is about.
    await m.click(buttonInCard(m.container, t.cardAuthor, t.chooseImage))
    expect(m.text()).toContain(t.mediaTitle)
    await m.unmount()
  })
})
