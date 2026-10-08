// WHAT THE SAVE KEY SENDS, DECIDED WHEN IT RUNS, AND THE TWO DATES THAT ASK.
//
// Three things shipped wrong here. Save and ⌘S on a live post whose date had moved ahead took it
// off the site and said "Changes saved"; on a scheduled post whose date had moved back they put it
// out at once, unasked; and Save pressed while a Publish was still in flight had already decided
// "draft" and took the just-published post straight back off the site. These drive the real save
// queue (`saveChain`) and the real Save key (`liveSave`) against a pretend server.
import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { adminT } from '@/i18n/admin-i18n'
import { sheetWords, type SheetDraft } from '@/admin-shared/sheet-wire'
import { standing } from '@/admin-shared/sheet-state'
import { formatWallClock } from '@/i18n/format'
import { crossing, liveSave } from './sheet-live'
import { previewStep, saveChain, statusForSave, type Plan } from './sheet-save'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

type Status = SheetDraft['status']
const t = sheetWords(adminT('en'))
const NOW = Date.parse('2026-10-08T10:54:00Z')
const AHEAD = '2099-10-19T09:00'
const LATER = '2099-11-02T09:00'
const PAST = '2026-01-01T09:00'

describe('which saves move a published piece across now', () => {
  it('down: a LIVE piece saved published with a date ahead', () => {
    expect(crossing('published', 'published', '2026-10-19T09:00', 'UTC', NOW)).toBe('down')
  })
  it('up: a SCHEDULED piece saved published with a date now or gone', () => {
    expect(crossing('scheduled', 'published', PAST, 'UTC', NOW)).toBe('up')
    expect(crossing('scheduled', 'published', '2026-10-08T10:54', 'UTC', NOW)).toBe('up')
    expect(crossing('scheduled', 'published', '', 'UTC', NOW)).toBe('up')
  })
  it('neither when the date stays on its side', () => {
    expect(crossing('published', 'published', PAST, 'UTC', NOW)).toBe(null)
    expect(crossing('published', 'published', '', 'UTC', NOW)).toBe(null)
    expect(crossing('scheduled', 'published', '2026-10-19T09:00', 'UTC', NOW)).toBe(null)
  })
  it('never for a draft, nor for a save that unpublishes by the panel’s own choice', () => {
    expect(crossing('draft', 'published', '2026-10-19T09:00', 'UTC', NOW)).toBe(null)
    expect(crossing('draft', 'draft', PAST, 'UTC', NOW)).toBe(null)
    expect(crossing('published', 'draft', '2026-10-19T09:00', 'UTC', NOW)).toBe(null)
    expect(crossing('scheduled', 'draft', PAST, 'UTC', NOW)).toBe(null)
  })
})

describe('the crossing is on the SITE’s clock, not the browser’s', () => {
  const TEN_UTC = Date.parse('2026-10-08T10:00:00Z')
  const inBrowser = (tz: string, run: () => void): void => {
    // Put back by NAME: `delete process.env.TZ` leaves Bun on that zone for good after.
    const was = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone
    process.env.TZ = tz
    try { run() } finally { process.env.TZ = was }
  }
  it('site UTC, browser Hanoi, 10:00 UTC: a live post dated today 12:00 is taken DOWN, so it asks', () => {
    inBrowser('Asia/Ho_Chi_Minh', () => {
      expect(crossing('published', 'published', '2026-10-08T12:00', 'UTC', TEN_UTC)).toBe('down')
    })
  })
  it('site Hanoi, browser UTC, 17:00 in Hanoi: a scheduled post dated today 16:00 goes UP, so it asks', () => {
    inBrowser('UTC', () => {
      expect(crossing('scheduled', 'published', '2026-10-08T16:00', 'Asia/Ho_Chi_Minh', TEN_UTC)).toBe('up')
      expect(crossing('published', 'published', '2026-10-08T16:00', 'Asia/Ho_Chi_Minh', TEN_UTC)).toBe(null)
    })
  })
})

type Asked = { title: string; body?: string; confirmLabel: string; altLabel?: string; cancelLabel: string }

/**
 * A sheet against a pretend server. `server` is what it holds, `form` what the sheet shows; a
 * write stores the plan and, like the sheet, lets the form's status follow. `hold` keeps the
 * FIRST write in flight until `release` is called. `reply` answers the dialog; `null` is a page
 * with no dialog at all, `undefined` a dialog left open.
 */
function rig(o: {
  server: { status: Status; date: string }; form?: { status?: Status; date?: string }
  reply?: string | null; hold?: boolean
  /** How the FIRST write ends instead of storing: refused (409, a taken slug) or thrown (offline). */
  fail?: 'refused' | 'thrown'
}) {
  const server = { ...o.server }
  const form = { status: o.form?.status ?? server.status, date: o.form?.date ?? server.date }
  const plans: Plan[] = []
  const asked: Asked[] = []
  let release = (): void => {}
  const gate = new Promise<void>((r) => { release = r })
  const queue = saveChain(async (p) => {
    plans.push(p)
    if (o.hold && plans.length === 1) await gate
    if (o.fail && plans.length === 1) {
      if (o.fail === 'thrown') throw new Error('offline')
      return false
    }
    server.status = p.status
    server.date = form.date
    if (p.follow) form.status = p.status
    return true
  })
  const listen = (e: Event): void => {
    if (o.reply === null) return
    e.preventDefault()
    const d = (e as CustomEvent<{ request: Asked; respond: (a: string) => void }>).detail
    asked.push(d.request)
    if (o.reply) d.respond(o.reply)
  }
  window.addEventListener('quire:confirm', listen)
  const plain = liveSave({
    t, lang: 'en', queue, timezone: 'UTC',
    held: () => standing(server.status, server.date, 'UTC'), savedDate: () => server.date, date: () => form.date,
    status: () => statusForSave(server.status, form.status),
    keepDate: (d) => { form.date = d },
  })
  return {
    plain, queue, plans, asked, server, form, release: () => release(),
    stop: () => window.removeEventListener('quire:confirm', listen),
  }
}

describe('Save while a Publish is still in flight', () => {
  it('keeps the post published: the queued save reads what the publish left behind', async () => {
    const r = rig({ server: { status: 'draft', date: PAST }, hold: true })
    const publishing = r.queue(() => ({ status: 'published', done: t.published, follow: true }))
    await Promise.resolve()
    const saving = r.plain.press() // pressed while the server still holds a draft
    r.release()
    expect(await publishing).toBe(true)
    expect(await saving).toBe(true)
    r.stop()
    expect(r.plans.map((p) => p.status)).toEqual(['published', 'published'])
    expect(r.server.status).toBe('published')
    expect(r.plans[1]!.done).toBe(t.savedChanges)
  })

  it('a draft saved twice stays a draft, and a second press while one waits is the same press', async () => {
    const r = rig({ server: { status: 'draft', date: PAST }, hold: true })
    const first = r.queue(() => ({ status: 'draft', done: '', follow: true }))
    const a = r.plain.press()
    const b = r.plain.press()
    r.release()
    await first
    expect(await a).toBe(true)
    expect(await b).toBe(false)
    r.stop()
    expect(r.plans.map((p) => p.status)).toEqual(['draft', 'draft'])
  })
})

describe('a save queued behind one that FAILED', () => {
  for (const fail of ['refused', 'thrown'] as const) {
    it(`reads the server as it still is when the publish in front was ${fail}: a draft stays a draft`, async () => {
      const r = rig({ server: { status: 'draft', date: PAST }, hold: true, fail })
      const publishing = r.queue(() => ({ status: 'published', done: t.published, follow: true }))
      await Promise.resolve()
      const saving = r.plain.press()
      r.release()
      expect(await publishing.catch(() => false)).toBe(false)
      expect(await saving).toBe(true)
      r.stop()
      expect(r.plans.map((p) => p.status)).toEqual(['published', 'draft'])
      expect(r.server.status).toBe('draft')
      expect(r.form.status).toBe('draft')
    })
  }

  it('a live post whose Schedule was refused is still LIVE to the Save behind it, so Save asks', async () => {
    const r = rig({ server: { status: 'published', date: PAST }, form: { date: AHEAD }, hold: true, fail: 'refused', reply: 'cancel' })
    const scheduling = r.queue(() => ({ status: 'published', done: t.scheduled, follow: true }))
    await Promise.resolve()
    const saving = r.plain.press()
    r.release()
    expect(await scheduling).toBe(false)
    expect(await saving).toBe(false) // asked, and Cancel saved nothing
    r.stop()
    expect(r.asked).toHaveLength(1)
    expect(r.server.date).toBe(PAST)
  })
})

describe('Preview through the queue', () => {
  const previewIn = (r: ReturnType<typeof rig>, snaps: string[]) =>
    previewStep(() => r.server.status, () => r.form.status, async () => { snaps.push('snapshot'); return true })

  it('a draft is saved first, silently, as a draft', async () => {
    const r = rig({ server: { status: 'draft', date: PAST } })
    const snaps: string[] = []
    expect(await r.queue(previewIn(r, snaps))).toBe(true)
    r.stop()
    expect(r.plans).toEqual([{ status: 'draft', done: '' }])
    expect(snaps).toEqual([])
  })

  it('pressed while a Publish is in flight, it previews the now-live post by snapshot and never saves it', async () => {
    const r = rig({ server: { status: 'draft', date: PAST }, hold: true })
    const snaps: string[] = []
    const publishing = r.queue(() => ({ status: 'published', done: t.published, follow: true }))
    await Promise.resolve()
    const previewing = r.queue(previewIn(r, snaps))
    r.release()
    await publishing
    expect(await previewing).toBe(true)
    r.stop()
    expect(r.plans.map((p) => p.status)).toEqual(['published'])
    expect(snaps).toEqual(['snapshot'])
    expect(r.server.status).toBe('published')
  })
})

describe('a LIVE piece given a date ahead', () => {
  it('saves straight away when the date stays behind now', async () => {
    const r = rig({ server: { status: 'published', date: PAST }, reply: 'confirm' })
    await r.plain.press()
    r.stop()
    expect(r.asked).toEqual([])
    expect(r.plans).toEqual([{ status: 'published', done: t.savedChanges, follow: true }])
  })

  it('asks first, naming the date it comes back, with Schedule / Keep it live / Cancel', async () => {
    const r = rig({ server: { status: 'published', date: PAST }, form: { date: AHEAD }, reply: 'cancel' })
    await r.plain.press()
    r.stop()
    expect(r.asked).toHaveLength(1)
    const q = r.asked[0]!
    expect(q.body).toContain(formatWallClock(AHEAD, 'en'))
    expect([q.confirmLabel, q.altLabel, q.cancelLabel]).toEqual([t.schedule, t.keepLive, t.askCancel])
    expect(r.plans).toEqual([])
  })

  it('Schedule saves the new date, and the toast names it', async () => {
    const r = rig({ server: { status: 'published', date: PAST }, form: { date: AHEAD }, reply: 'confirm' })
    await r.plain.press()
    r.stop()
    expect(r.plans[0]!.status).toBe('published')
    expect(r.plans[0]!.done).toContain(formatWallClock(AHEAD, 'en'))
    expect(r.server.date).toBe(AHEAD)
  })

  it('Keep it live puts the saved date back before the save', async () => {
    const r = rig({ server: { status: 'published', date: PAST }, form: { date: AHEAD }, reply: 'alt' })
    await r.plain.press()
    r.stop()
    expect(r.plans).toEqual([{ status: 'published', done: t.keptLive, follow: true }])
    expect(r.server.date).toBe(PAST)
  })
})

describe('a SCHEDULED piece given a date now or gone', () => {
  it('asks first, naming the schedule it leaves, with Publish now / Keep it scheduled / Cancel', async () => {
    const r = rig({ server: { status: 'published', date: AHEAD }, form: { date: PAST }, reply: 'cancel' })
    await r.plain.press()
    r.stop()
    expect(r.asked).toHaveLength(1)
    const q = r.asked[0]!
    expect(q.title).toBe(t.publishNowTitle)
    expect(q.body).toContain(formatWallClock(AHEAD, 'en'))
    expect([q.confirmLabel, q.altLabel, q.cancelLabel]).toEqual([t.publishNow, t.keepScheduled, t.askCancel])
    expect(r.plans).toEqual([])
    expect(r.server.date).toBe(AHEAD)
  })

  it('Publish now saves the date, and says Published', async () => {
    const r = rig({ server: { status: 'published', date: AHEAD }, form: { date: PAST }, reply: 'confirm' })
    await r.plain.press()
    r.stop()
    expect(r.plans).toEqual([{ status: 'published', done: t.published, follow: true }])
    expect(r.server.date).toBe(PAST)
  })

  it('Keep it scheduled puts the scheduled date back, and says so', async () => {
    const r = rig({ server: { status: 'published', date: AHEAD }, form: { date: PAST }, reply: 'alt' })
    await r.plain.press()
    r.stop()
    expect(r.server.date).toBe(AHEAD)
    expect(r.plans[0]!.done).toContain(formatWallClock(AHEAD, 'en'))
  })

  it('a scheduled piece moved to another future date asks nothing', async () => {
    const r = rig({ server: { status: 'published', date: AHEAD }, form: { date: LATER }, reply: 'confirm' })
    await r.plain.press()
    r.stop()
    expect(r.asked).toEqual([])
    expect(r.server.date).toBe(LATER)
  })
})

describe('what asks nothing, and what saves nothing', () => {
  it('a draft asks nothing whatever its date', async () => {
    for (const date of [AHEAD, PAST]) {
      const r = rig({ server: { status: 'draft', date: AHEAD }, form: { date }, reply: 'confirm' })
      await r.plain.press()
      r.stop()
      expect(r.asked).toEqual([])
      expect(r.plans).toEqual([{ status: 'draft', done: t.savedDraft, follow: true }])
    }
  })

  it('a question nobody answers saves nothing', async () => {
    const r = rig({ server: { status: 'published', date: PAST }, form: { date: AHEAD }, reply: null })
    expect(await r.plain.press()).toBe(false)
    r.stop()
    expect(r.plans).toEqual([])
  })

  it('a second press while the question is open is ignored, not asked over it', async () => {
    const r = rig({ server: { status: 'published', date: PAST }, form: { date: AHEAD }, reply: undefined })
    void r.plain.press()
    await Promise.resolve()
    void r.plain.press()
    await Promise.resolve()
    r.stop()
    expect(r.asked).toHaveLength(1)
    expect(r.plans).toEqual([])
  })
})

describe('the toast after the main key schedules', () => {
  it('names the date when it took a live piece down, and says Scheduled otherwise', () => {
    const live = rig({ server: { status: 'published', date: PAST }, form: { date: AHEAD } })
    live.stop()
    expect(live.plain.scheduledSay()).toContain(formatWallClock(AHEAD, 'en'))
    const draft = rig({ server: { status: 'draft', date: PAST }, form: { date: AHEAD } })
    draft.stop()
    expect(draft.plain.scheduledSay()).toBe(t.scheduled)
  })
})
