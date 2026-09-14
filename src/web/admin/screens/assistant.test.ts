// The assistant, as the server sends it (ADR 0054).
//
// THREE THINGS ARE GUARDED HERE, and the first is a safety rule rather than a preference.
//
//   1. NOTHING ON THIS SCREEN IS A FORM, and every button says `type="button"`. HTML's default
//      for a button inside a form is `submit`, so a form anywhere on this page would let Enter
//      in any field issue a request — and the request this screen makes reaches a paid provider
//      and runs tools against the live blog.
//   2. Both faces ship drawn: the empty page and the conversation named in the address.
//
// The third guard — that the server's markup and the island's nodes come from one description
// and stay identical — is `src/admin/island/mark-agreement.test.ts`, because comparing them
// needs a DOM and this side of the tree deliberately has no DOM types.
import { describe, it, expect, afterAll, beforeEach } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { withoutProviderEnv } from '@/test/env'
import { saveIntegrationKeys } from '@/store/integration-keys'
import { db } from '@/store/db'
import { createChat, saveChat } from '@/server/assistant-chats'
import { getSettings } from '@/content/settings'
import { noUsage } from '@/server/assistant-dialects'
import type { Turn } from '@/admin-shared/assistant'
import { blockMarks, logEntryMark } from '@/admin-shared/assistant-marks'
import { htmlOf } from '@/web/admin/mark-html'
import { assistantScreen } from './assistant'

const DIR = './.tmp/test-screen-assistant'
freshDatabase(DIR)
// A developer `.env` with `AI_PROVIDER`/`AI_API_KEY` in it would otherwise decide which face
// of the empty state these tests are looking at.
withoutProviderEnv()
afterAll(() => dropDatabase(DIR))
beforeEach(() => db().run(`delete from assistant_chats`))

const draw = async (query = ''): Promise<string> =>
  assistantScreen(await getSettings(), new URLSearchParams(query))

const WORDS = {
  busy: 'Working…', send: 'Send', failed: 'no answer', notConfigured: 'no model',
  wants: 'It wants to do this', afterReaders: 'readers spoke', allow: 'Allow', deny: "Don't",
  tokensLabel: 'tokens', context: 'Context', showAll: 'Show all', close: 'Close',
  untitled: 'Untitled', noChats: 'Nothing yet.', deleteOne: 'Delete', deleteYes: 'Delete',
  didNothing: 'Nothing yet in this conversation.',
}

describe('nothing on this screen can submit anything', () => {
  it('has no form at all', async () => {
    expect(await draw()).not.toContain('<form')
  })

  it('says type="button" on every single button', async () => {
    const html = await draw()
    const buttons = html.match(/<button\b[^>]*>/g) ?? []
    expect(buttons.length).toBeGreaterThan(0)
    expect(buttons.filter((b) => !b.includes('type="button"'))).toEqual([])
  })

  it('holds no input inside anything that could post', async () => {
    const html = await draw()
    expect(html).not.toContain('<form')
    expect(html).toContain('<textarea')
  })

  it('says type="button" on every button of a drawn transcript too', () => {
    const turns: Turn[] = [
      { kind: 'user', text: 'go' },
      { kind: 'tool_use', id: 'a', name: 'update_settings', args: { title: 'x' }, at: 1 },
      { kind: 'tool_result', id: 'a', name: 'update_settings', text: `{"ok":${'1'.repeat(900)}}` },
      { kind: 'assistant', text: 'done' },
    ]
    const html = htmlOf(blockMarks(turns, WORDS)) + htmlOf(logEntryMark(
      { id: 'a', name: 'update_settings', args: {}, result: 'y'.repeat(900) }, WORDS,
    ))
    const buttons = html.match(/<button\b[^>]*>/g) ?? []
    expect(buttons.length).toBeGreaterThan(0)
    expect(buttons.filter((b) => !b.includes('type="button"'))).toEqual([])
  })
})

describe('both faces ship drawn', () => {
  it('opens empty, and with no model it offers the screen that fixes that', async () => {
    const html = await draw()
    expect(html).toContain('data-ai-empty')
    expect(html).not.toContain('data-ai-empty hidden')
    expect(html).toContain('data-ai-blocks hidden')
    // Not a silent state: no model is a LINK to the place a key goes, and the composer is shut.
    expect(html).not.toContain('data-ai-eg')
    expect(html).toContain('/admin/settings?tab=server')
    expect(html).toContain('<textarea')
    expect(html).toMatch(/<textarea[^>]* disabled/)
  })

  it('offers the three examples once a model is connected', async () => {
    await saveIntegrationKeys({ aiProvider: 'anthropic', aiApiKey: 'not-a-real-key', aiModel: 'a-model' })
    try {
      const html = await draw()
      expect((html.match(/data-ai-eg/g) ?? []).length).toBe(3)
      expect(html).toContain('a-model')
      expect(html).not.toMatch(/<textarea[^>]* disabled/)
    } finally {
      await saveIntegrationKeys({ aiProvider: '', aiApiKey: '', aiModel: '' })
    }
  })

  it('draws the conversation named in the address', async () => {
    const id = createChat()
    saveChat(id, [
      { kind: 'user', text: 'how many drafts' },
      { kind: 'assistant', text: 'You have **three**.' },
    ], noUsage(), 1234)
    const html = await draw(`chat=${id}`)
    expect(html).toContain(`data-ai-open="${id}"`)
    expect(html).toContain('how many drafts')
    expect(html).toContain('<strong class="font-semibold">three</strong>')
    // The empty state is still in the markup, hidden, so the island can restore it.
    expect(html).toContain('data-ai-empty hidden')
    expect(html).toContain('1.2k')
  })

  it('opens empty for an id that names no conversation', async () => {
    const html = await draw('chat=999999')
    expect(html).not.toContain('data-ai-empty hidden')
    expect(html).not.toContain('data-ai-open=')
  })

  it('opens empty for an id that is not a number', async () => {
    expect(await draw('chat=../../etc/passwd')).not.toContain('data-ai-open=')
  })

  it('never puts a row name on the screen itself', async () => {
    // `[data-ai-chat]:not([data-ai-confirming]) [data-ai-confirm]` is what keeps a row's delete
    // confirm shut. The screen root once carried `data-ai-chat` as well, and every confirm in
    // the column then matched through that ancestor and could never open. The name belongs to
    // a row; the screen says `data-ai-open`.
    const id = createChat()
    saveChat(id, [{ kind: 'user', text: 'x' }], noUsage(), 0)
    const html = await draw(`chat=${id}`)
    const root = html.slice(0, html.indexOf('>') + 1)
    expect(root).toContain('data-ai-open=')
    expect(root).not.toContain('data-ai-chat=')
  })

  it('lists the conversations in the column without reading their transcripts', async () => {
    const first = createChat()
    saveChat(first, [{ kind: 'user', text: 'the first question' }], noUsage(), 10)
    const html = await draw()
    expect(html).toContain(`href="/admin/assistant?chat=${first}"`)
    expect(html).toContain('the first question')
    expect(html).toContain('data-ai-no-chats hidden')
  })

  it('says so when there is no conversation at all', async () => {
    const html = await draw()
    expect(html).toContain('data-ai-no-chats>')
  })

  it('draws the raw record beside the transcript', async () => {
    const id = createChat()
    saveChat(id, [
      { kind: 'user', text: 'sweep' },
      { kind: 'tool_use', id: 't', name: 'list_comments', args: { n: 5 }, at: 1_700_000_000_000 },
      { kind: 'tool_result', id: 't', name: 'list_comments', text: '{"comments":[]}' },
    ], noUsage(), 0)
    const html = await draw(`chat=${id}`)
    expect(html).toContain('list_comments')
    expect(html).toContain('&quot;comments&quot;')
    expect(html).toContain('data-ai-log-empty hidden')
  })
})

describe('nothing a model or a tool wrote becomes markup', () => {
  it('escapes an answer, a question and a tool result alike', async () => {
    const id = createChat()
    const bomb = '<img src=x onerror="alert(1)">'
    saveChat(id, [
      { kind: 'user', text: bomb },
      { kind: 'assistant', text: bomb },
      { kind: 'tool_use', id: 'b', name: 'x', args: { a: bomb } },
      { kind: 'tool_result', id: 'b', name: 'x', text: bomb },
    ], noUsage(), 0)
    const html = await draw(`chat=${id}`)
    // The whole string, exactly as it was stored: if it never appears, nothing was injected.
    // Asserting on `onerror=` alone would fail on the ESCAPED copy, which is the correct
    // output — `&lt;img src=x onerror=&quot;…` is four words on the page and no attribute.
    expect(html).not.toContain(bomb)
    expect(html).not.toContain('<img')
  })
})
