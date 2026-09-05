// The rail's order, as arithmetic — the half of arrange mode a browser cannot answer for.
//
// Every case here is a way the rail could come back WRONG rather than broken: a row in two
// places, a row that vanishes on upgrade, a drag that lands one row short of where it was
// dropped. None of them throws, and a screenshot of a rail that looks plausible is exactly
// what each one produces.
import { expect, test, describe } from 'bun:test'
import { EMPTY_NAV_ORDER, isDefaultOrder, reconcileNavOrder, sanitizeNavOrder } from '@/content/nav-order'
import { moveTo, step } from '@/admin/components/useNavArrange'
import type { NavOrder } from '@/types'

const order = (primary: string[], more: string[] = [], footer: string[] = [], hidden: string[] = []): NavOrder =>
  ({ primary, more, footer, hidden })

const DEFAULTS = order(
  ['home', 'write', 'media', 'newsletter', 'more'],
  ['analytics', 'comments', 'trash', 'settings', 'log', 'help', 'viewBlog'],
  ['collapse', 'theme', 'icons', 'cache', 'signout'],
)

describe('sanitizeNavOrder', () => {
  test('keeps known ids in the order they were sent', () => {
    const got = sanitizeNavOrder({ primary: ['write', 'home'], more: [], footer: [], hidden: [] }, EMPTY_NAV_ORDER)
    expect(got.primary).toEqual(['write', 'home'])
  })

  test('drops ids the rail does not have', () => {
    const got = sanitizeNavOrder({ primary: ['home', 'wordpress', 42, null], more: [], footer: [], hidden: [] }, EMPTY_NAV_ORDER)
    expect(got.primary).toEqual(['home'])
  })

  test('a row cannot be in two lists at once', () => {
    // What an interrupted drag or a hand-written payload produces. Two Settings rows is a
    // rail that answers "where is it?" twice.
    const got = sanitizeNavOrder({ primary: ['settings', 'home'], more: ['settings'], footer: [], hidden: [] }, EMPTY_NAV_ORDER)
    expect(got.primary).toEqual(['settings', 'home'])
    expect(got.more).toEqual([])
  })

  test('hidden is counted separately, so hiding search does not remove it from a list', () => {
    const got = sanitizeNavOrder({ primary: ['home'], more: [], footer: [], hidden: ['search', 'logo'] }, EMPTY_NAV_ORDER)
    expect(got.primary).toEqual(['home'])
    expect(got.hidden).toEqual(['search', 'logo'])
  })

  test('a missing field is an empty list, never a crash', () => {
    expect(sanitizeNavOrder({}, EMPTY_NAV_ORDER)).toEqual(EMPTY_NAV_ORDER)
    expect(sanitizeNavOrder('nonsense', EMPTY_NAV_ORDER)).toEqual(EMPTY_NAV_ORDER)
  })

  test('undefined keeps what was already stored', () => {
    const stored = order(['write', 'home'])
    expect(sanitizeNavOrder(undefined, stored)).toBe(stored)
  })
})

describe('reconcileNavOrder', () => {
  test('never arranged means the rail the code has', () => {
    expect(isDefaultOrder(EMPTY_NAV_ORDER)).toBe(true)
    expect(reconcileNavOrder(EMPTY_NAV_ORDER, DEFAULTS)).toEqual(DEFAULTS)
  })

  test('a row added by an upgrade appears at its designed index', () => {
    // An owner who arranged the rail before `comments` existed. It must not be missing, and
    // it must not be dumped at the bottom.
    const stored = order(
      ['write', 'home', 'media', 'newsletter', 'more'],
      ['analytics', 'trash', 'settings', 'log', 'help', 'viewBlog'],
      ['collapse', 'theme', 'icons', 'cache', 'signout'],
    )
    const got = reconcileNavOrder(stored, DEFAULTS)
    expect(got.more).toEqual(['analytics', 'comments', 'trash', 'settings', 'log', 'help', 'viewBlog'])
  })

  test('a row the rail no longer has is dropped', () => {
    const stored = order(['home', 'gopher', 'write', 'media', 'newsletter', 'more'], DEFAULTS.more, DEFAULTS.footer)
    expect(reconcileNavOrder(stored, DEFAULTS).primary).not.toContain('gopher')
  })

  test('the owner keeps their arrangement', () => {
    const stored = order(['write', 'home', 'media', 'newsletter', 'more'], DEFAULTS.more, DEFAULTS.footer)
    expect(reconcileNavOrder(stored, DEFAULTS).primary).toEqual(['write', 'home', 'media', 'newsletter', 'more'])
  })

  test('hidden survives a reset of the order', () => {
    const stored = order([], [], [], ['logo'])
    expect(reconcileNavOrder(stored, DEFAULTS).hidden).toEqual(['logo'])
    expect(reconcileNavOrder(stored, DEFAULTS).primary).toEqual(DEFAULTS.primary)
  })
})

describe('moveTo', () => {
  test('down inside one list lands where it was dropped, not one short', () => {
    // The off-by-one every drag list has: the target index counts the row being moved.
    const got = moveTo(order(['home', 'write', 'media']), 'home', { zone: 'primary', index: 2 })
    expect(got.primary).toEqual(['write', 'home', 'media'])
  })

  test('up inside one list', () => {
    const got = moveTo(order(['home', 'write', 'media']), 'media', { zone: 'primary', index: 0 })
    expect(got.primary).toEqual(['media', 'home', 'write'])
  })

  test('across lists', () => {
    const got = moveTo(order(['home', 'write'], ['settings']), 'settings', { zone: 'primary', index: 1 })
    expect(got.primary).toEqual(['home', 'settings', 'write'])
    expect(got.more).toEqual([])
  })

  test('an id that is not in the order changes nothing', () => {
    const before = order(['home'])
    expect(moveTo(before, 'trash', { zone: 'primary', index: 0 })).toBe(before)
  })
})

describe('step', () => {
  test('walks off the end of one list into the top of the next', () => {
    const got = step(order(['home', 'write'], ['settings']), 'write', 1)
    expect(got.primary).toEqual(['home'])
    expect(got.more).toEqual(['write', 'settings'])
  })

  test('walks back up into the bottom of the list above', () => {
    const got = step(order(['home', 'write'], ['settings']), 'settings', -1)
    expect(got.primary).toEqual(['home', 'write', 'settings'])
    expect(got.more).toEqual([])
  })

  test('the very top and the very bottom hold', () => {
    const top = order(['home', 'write'], [], [])
    expect(step(top, 'home', -1)).toEqual(top)
    const bottom = order([], [], ['cache', 'signout'])
    expect(step(bottom, 'signout', 1)).toEqual(bottom)
  })

  test('one step down, then one step up, is where it started', () => {
    const before = order(['home', 'write', 'media'], ['settings'], ['cache'])
    const there = step(before, 'write', 1)
    expect(step(there, 'write', -1)).toEqual(before)
  })
})
