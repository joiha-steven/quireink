// The action line's words follow what the piece IS on the server (2026-09-30): on a live post
// the preview shows an unsaved edit, and "Preview draft" called it a draft.
import { describe, expect, it } from 'bun:test'
import { adminT } from '@/i18n/admin-i18n'
import { sheetActions, type SheetLinks } from './sheet-actions'

const t = adminT('en')
const links = (published: boolean): SheetLinks => ({
  live: { href: '/a-post', label: t.viewPost }, liveNow: published,
  canPreview: true, previewNow: true,
  publish: t.publish, schedule: t.schedule, update: t.update,
  main: published ? 'update' : 'publish', mainReady: !published, published,
})

describe('the preview key', () => {
  it('says draft on a draft and changes on a live post', () => {
    expect(sheetActions(t, links(false))).toContain(`>${t.previewDraft}<`)
    const live = sheetActions(t, links(true))
    expect(live).toContain(`>${t.previewChanges}<`)
    expect(live).not.toContain(`>${t.previewDraft}<`)
  })
})

describe('the main key', () => {
  const key = (html: string): string => html.slice(html.indexOf('data-sheet-publish'), html.indexOf('</button>', html.indexOf('data-sheet-publish')))
  it('says Publish on a draft and can be pressed', () => {
    const k = key(sheetActions(t, links(false)))
    expect(k).toContain(`>${t.publish}`)
    expect(k).not.toContain(' disabled')
  })
  it('says Update on a live post, waiting for a change', () => {
    const k = key(sheetActions(t, links(true)))
    expect(k).toContain(`>${t.update}`)
    expect(k).toContain(' disabled')
    expect(k).toContain(`data-say-update="${t.update}"`)
  })
})

describe('the recovered-work notice', () => {
  it('makes Restore the primary key and Discard the quiet one', () => {
    const html = sheetActions(t, links(false))
    const restore = html.slice(html.indexOf('data-sheet-restore'), html.indexOf('</button>', html.indexOf('data-sheet-restore')))
    const discard = html.slice(html.indexOf('data-sheet-discard'), html.indexOf('</button>', html.indexOf('data-sheet-discard')))
    expect(restore).toContain('kit-btn-primary')
    expect(discard).toContain('kit-btn-ghost')
    expect(html).toContain('data-sheet-found hidden role="status"')
  })
})
