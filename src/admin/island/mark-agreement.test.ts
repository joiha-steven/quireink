// THE SERVER DRAWS WHAT THE ISLAND BUILDS, and this is what holds them to it.
//
// The assistant is the first screen where the same markup is produced twice: by the server for
// a conversation read out of the database, and by the island for one still arriving over the
// wire. Written twice they would drift — a class added on one side, a `<p>` that became a
// `<div>` on the other — and the transcript would read as two different screens depending on
// whether you had reloaded. So the SHAPE is written once as data (`@/admin-shared/markup`) and
// rendered by two dumb walks: `htmlOf` into a string, `elOf` into nodes.
//
// Here, because comparing them needs a DOM: this directory is one of the two that gets DOM
// types, and the server half of the tree deliberately does not.
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import type { Turn } from '@/admin-shared/assistant'
import type { Mark } from '@/admin-shared/markup'
import { blockMarks, chatRowMark, logEntryMark } from '@/admin-shared/assistant-marks'
import { mediaTileMark } from '@/admin-shared/media-marks'
import { richMarks } from '@/admin-shared/rich-text'
import { htmlOf } from '@/web/admin/mark-html'
import { elOf } from './lib/mark-dom'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const WORDS = {
  busy: 'Working…', send: 'Send', failed: 'no answer', notConfigured: 'no model',
  wants: 'It wants to do this', afterReaders: 'readers spoke', allow: 'Allow', deny: "Don't",
  tokensLabel: 'tokens', context: 'Context', showAll: 'Show all', close: 'Close',
  untitled: 'Untitled', noChats: 'Nothing yet.', deleteOne: 'Delete', deleteYes: 'Delete',
  didNothing: 'Nothing yet in this conversation.',
}

/**
 * Both sides through ONE serializer, which is the only way to compare them honestly.
 *
 * `escapeHtml` writes `&quot;` in text where the DOM writes a plain quote, and the server
 * writes a bare `data-ai-tail` where the DOM writes `data-ai-tail=""`. Both pairs are the same
 * document; only the ink differs. Parsing the server's markup back into a DOM removes every
 * such difference and leaves exactly the ones that matter — a tag, a class, an attribute or a
 * child that one side has and the other does not.
 */
const same = (mark: Mark): void => {
  const built = document.createElement('div')
  built.appendChild(elOf(mark))
  const sent = document.createElement('div')
  sent.innerHTML = htmlOf(mark)
  expect(built.innerHTML).toBe(sent.innerHTML)
}

const CONVERSATION: Turn[] = [
  { kind: 'user', text: 'list them' },
  { kind: 'tool_use', id: 'a', name: 'list_posts', args: { limit: 3 }, at: 1_700_000_000_000 },
  { kind: 'tool_result', id: 'a', name: 'list_posts', text: '{"posts":["one","two"]}' },
  { kind: 'assistant', text: 'Two:\n\n- **one**\n- `two`\n\n| a | b |\n|---|---|\n| 1 | 2 |' },
]

describe('the server draws what the island builds', () => {
  it('agrees on a whole exchange, marks and table and chips and all', () => {
    for (const mark of blockMarks(CONVERSATION, WORDS)) same(mark)
  })

  it('agrees on an exchange that is waiting, streaming, paused and paid for', () => {
    const marks = blockMarks(CONVERSATION, WORDS, {
      live: 'still **arri',
      waiting: false,
      awaiting: [{ id: 'p', name: 'delete_post', args: { slug: 'x' }, reason: 'untrusted' }],
      cost: { input: 1200, output: 300 },
    })
    for (const mark of marks) same(mark)
  })

  it('agrees on an exchange that is only waiting', () => {
    for (const mark of blockMarks([{ kind: 'user', text: 'go' }], WORDS, { waiting: true })) same(mark)
  })

  it('agrees on a log entry, including the fold and its two halves', () => {
    same(logEntryMark({ id: 'a', name: 'get_traffic', args: { days: 7 }, at: 1, result: 'z'.repeat(900) }, WORDS))
    same(logEntryMark({ id: 'b', name: 'get_traffic', args: {} }, WORDS))
  })

  it('agrees on a chat row, open and shut, including the SVG cross', () => {
    const row = { id: 4, title: 'A chat', updatedAt: new Date(1_700_000_000_000).toISOString(), context: 2400 }
    same(chatRowMark(row, 4, WORDS))
    same(chatRowMark(row, null, WORDS))
    same(chatRowMark({ ...row, title: '', context: 0 }, null, WORDS))
  })

  it('agrees on an answer that is trying to be markup', () => {
    for (const mark of richMarks('<b>no</b> & "quotes" — and **bold**')) same(mark)
  })

  // The library draws every tile; the picker draws the same tile over whatever screen asked
  // for a picture. Eighteen of them to a screen makes this the loudest place two renderers
  // could disagree.
  const PICTURE = {
    url: '/uploads/media/plate-14.png',
    filename: 'plate-14.png',
    size: 220_114,
    uploadedAt: new Date(1_700_000_000_000).toISOString(),
    width: 1400,
    height: 900,
    thumb: '/uploads/media/plate-14-thumb.webp',
    alt: 'A nib at three angles',
  }
  const PICK_WORDS = { copyUrl: 'Copy URL', download: 'Download', delete: 'Delete', unusedBadge: 'Unused' }

  it('agrees on a library tile, chosen and not, with its three keys', () => {
    for (const selected of [false, true]) {
      same(mediaTileMark(PICTURE, PICK_WORDS, {
        mode: 'page', tickable: true, selected, unused: true, sizeLabel: '215.0 KB', title: 'plate-14.png',
      }))
    }
  })

  it('agrees on a picker tile, which has no keys and sometimes no tick', () => {
    for (const tickable of [false, true]) {
      same(mediaTileMark({ ...PICTURE, alt: undefined, thumb: undefined }, PICK_WORDS, {
        mode: 'picker', tickable, sizeLabel: '215.0 KB', title: 'plate-14.png',
      }))
    }
  })

  it('draws the three keys as real drawings, on both sides', () => {
    const built = document.createElement('div')
    built.appendChild(elOf(mediaTileMark(PICTURE, PICK_WORDS, {
      mode: 'page', tickable: true, sizeLabel: '215.0 KB', title: 'x',
    })))
    // `data-glyph` is the one thing a tree of marks cannot say on its own, and it is filled
    // from `@/icons` by both renderers. An empty `<svg>` means the lookup silently missed.
    const glyphs = [...built.querySelectorAll('[data-glyph]')]
    expect(glyphs).toHaveLength(3)
    for (const g of glyphs) expect(g.childElementCount).toBeGreaterThan(0)
  })

  it('puts the cross in the SVG namespace, where a stroke means something', () => {
    const row = { id: 1, title: 'x', updatedAt: new Date(0).toISOString(), context: 0 }
    const built = document.createElement('div')
    built.appendChild(elOf(chatRowMark(row, null, WORDS)))
    const svg = built.querySelector('svg')
    expect(svg?.namespaceURI).toBe('http://www.w3.org/2000/svg')
    expect(svg?.querySelector('path')?.namespaceURI).toBe('http://www.w3.org/2000/svg')
  })
})
