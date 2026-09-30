// The action line's words follow what the piece IS on the server (2026-09-30): on a live post
// the preview shows an unsaved edit, and "Preview draft" called it a draft.
import { describe, expect, it } from 'bun:test'
import { adminT } from '@/i18n/admin-i18n'
import { sheetActions, type SheetLinks } from './sheet-actions'

const t = adminT('en')
const links = (published: boolean): SheetLinks => ({
  live: { href: '/a-post', label: t.viewPost }, liveNow: published,
  canPreview: true, previewNow: true,
  publish: t.publish, schedule: t.schedule, scheduled: false, published,
})

describe('the preview key', () => {
  it('says draft on a draft and changes on a live post', () => {
    expect(sheetActions(t, links(false))).toContain(`>${t.previewDraft}<`)
    const live = sheetActions(t, links(true))
    expect(live).toContain(`>${t.previewChanges}<`)
    expect(live).not.toContain(`>${t.previewDraft}<`)
  })
})
