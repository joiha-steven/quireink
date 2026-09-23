// The three pieces of analytics arithmetic, at the edges where each one can print something
// false. Every case here is a shape that reached a screen at some point: a flag from a
// country field holding something that is not a country, "0s" printed as "0m 0s", and a
// trend arrow against a baseline of nothing.
import { describe, expect, it } from 'bun:test'
import { flag, formatDuration, trendOf } from '@/admin-shared/analytics'

describe('the flag beside a country', () => {
  it('turns a two-letter code into regional indicators', () => {
    expect(flag('VN')).toBe('🇻🇳')
    expect(flag('vn')).toBe('🇻🇳')
  })

  // `topCountries` carries whatever the lookup wrote, and that has included 'Unknown' and ''.
  // A row is still a row; it simply has no flag on it.
  it('says nothing for anything that is not a code', () => {
    for (const bad of ['', 'U', 'USA', 'Unknown', '12', 'V1']) expect(flag(bad)).toBe('')
  })
})

describe('how long somebody stayed', () => {
  it('counts seconds under a minute', () => {
    expect(formatDuration(1_000)).toBe('1s')
    expect(formatDuration(59_400)).toBe('59s')
  })

  it('drops the seconds when there are none, rather than printing "2m 0s"', () => {
    expect(formatDuration(120_000)).toBe('2m')
    expect(formatDuration(125_000)).toBe('2m 5s')
  })

  // Nothing measured and nothing to say are the same string here; the CALLER decides whether
  // to print an em-dash instead, which the top-pages table does and the headline band does not.
  it('answers 0s for missing, zero and negative', () => {
    expect(formatDuration(undefined)).toBe('0s')
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(400)).toBe('0s')
  })
})

describe('the trend arrow', () => {
  it('reads a rise and a fall', () => {
    expect(trendOf(120, 100)).toEqual({ up: true, label: '20%' })
    expect(trendOf(80, 100)).toEqual({ up: false, label: '20%' })
  })

  it('draws nothing when an arrow would be a lie', () => {
    expect(trendOf(100, undefined)).toBeNull()
    expect(trendOf(100, 0)).toBeNull()
    expect(trendOf(100, 100)).toBeNull()
  })

  // Rounding, not truncation: a change of 0.4% is no change to a reader and gets no arrow.
  it('says nothing for a change that rounds to nothing', () => {
    expect(trendOf(1004, 1000)).toBeNull()
    expect(trendOf(1005, 1000)).toEqual({ up: true, label: '1%' })
  })

  // It capped at ">999%" until 2026-09-23, which read as a broken counter. From three times up a
  // rise is said the way anybody says it.
  it('says a large rise as a multiple, never a four-digit percentage', () => {
    expect(trendOf(299, 100)).toEqual({ up: true, label: '199%' })
    expect(trendOf(300, 100)).toEqual({ up: true, label: '×3' })
    expect(trendOf(450, 100)).toEqual({ up: true, label: '×4.5' })
    expect(trendOf(12_584, 100)).toEqual({ up: true, label: '×126' })
  })

  // A fall can never pass -100%, so the cap is a one-sided rule and the sign is carried by
  // `up` rather than by the label. Asserted so a later "simplification" to a signed string
  // does not quietly reintroduce "▼ -20%".
  it('keeps the label unsigned and the direction separate', () => {
    expect(trendOf(0, 100)).toEqual({ up: false, label: '100%' })
  })
})
