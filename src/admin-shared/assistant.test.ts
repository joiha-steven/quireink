// The four small sums both faces of the assistant do over a conversation.
//
// These were untested for as long as they lived inside React components, and two of them are
// exactly the kind of arithmetic that is wrong in a way nobody notices: a cost chip on the
// wrong exchange, or a settings answer shown under a media call.
import { describe, expect, it } from 'bun:test'
import {
  FOLD, blocksOf, entriesOf, foldMarks, jsonMarks, tokens, windowed, type Turn,
} from '@/admin-shared/assistant'
import { htmlOf } from '@/web/admin/mark-html'

describe('a token count is read, not calculated with', () => {
  it('prints what is under a thousand as itself', () => {
    expect(tokens(0)).toBe('0')
    expect(tokens(999)).toBe('999')
  })

  it('gives one decimal between a thousand and ten', () => {
    expect(tokens(1240)).toBe('1.2k')
    expect(tokens(9949)).toBe('9.9k')
  })

  it('drops the decimal past ten thousand, where it says nothing', () => {
    expect(tokens(10_000)).toBe('10k')
    expect(tokens(64_512)).toBe('65k')
  })
})

describe('a question opens a block and everything after it belongs there', () => {
  const turns: Turn[] = [
    { kind: 'user', text: 'one' },
    { kind: 'tool_use', id: 'a', name: 'list_posts', args: {} },
    { kind: 'tool_result', id: 'a', name: 'list_posts', text: '[]' },
    { kind: 'assistant', text: 'none' },
    { kind: 'user', text: 'two' },
    { kind: 'assistant', text: 'ok' },
  ]

  it('makes one block per question', () => {
    expect(blocksOf(turns).map((b) => b.question)).toEqual(['one', 'two'])
  })

  it('hands each block only what came after its own question', () => {
    expect(blocksOf(turns)[0]?.parts).toHaveLength(3)
    expect(blocksOf(turns)[1]?.parts).toHaveLength(1)
  })

  it('drops nothing and throws nothing when a transcript opens with an answer', () => {
    expect(blocksOf([{ kind: 'assistant', text: 'orphan' }])).toEqual([])
  })
})

describe('a call is paired with its result BY ID', () => {
  // Parallel calls are dispatched together and come back in whatever order the tools
  // finished, so walking the list in pairs hands the wrong answer to the wrong call.
  const crossed: Turn[] = [
    { kind: 'user', text: 'go' },
    { kind: 'tool_use', id: 'first', name: 'get_settings', args: {}, at: 1 },
    { kind: 'tool_use', id: 'second', name: 'list_media', args: { n: 2 }, at: 2 },
    { kind: 'tool_result', id: 'second', name: 'list_media', text: 'MEDIA' },
    { kind: 'tool_result', id: 'first', name: 'get_settings', text: 'SETTINGS' },
  ]

  it('gives each call its own answer even when they came back crossed', () => {
    const out = entriesOf(crossed)
    expect(out.map((e) => e.name)).toEqual(['get_settings', 'list_media'])
    expect(out[0]?.result).toBe('SETTINGS')
    expect(out[1]?.result).toBe('MEDIA')
  })

  it('keeps a call whose result never came, because that is the fact', () => {
    const out = entriesOf([{ kind: 'tool_use', id: 'x', name: 'slow', args: {} }])
    expect(out).toHaveLength(1)
    expect(out[0]?.result).toBeUndefined()
  })

  it('ignores a result for a call that is not in this conversation', () => {
    expect(entriesOf([{ kind: 'tool_result', id: 'ghost', name: 'x', text: 'y' }])).toEqual([])
  })
})

describe('JSON is made readable with ink level, not colour', () => {
  it('gives a key, a value and the punctuation between them three different inks', () => {
    const inks = new Set(jsonMarks('{"a":"b"}').map((m) => m.cls))
    expect(inks.size).toBe(3)
  })

  it('shows a truncated result rather than refusing it', () => {
    expect(htmlOf(jsonMarks('{"a":"unter'))).toContain('unter')
  })

  it('never returns nothing, so a fold always has something to open', () => {
    expect(jsonMarks('')).toHaveLength(1)
  })
})

describe('a long result is cut in two without being tinted twice', () => {
  const long = `{"text":"${'x'.repeat(FOLD * 2)}"}`

  it('leaves a short result whole, with no tail', () => {
    const { head, tail } = foldMarks('{"a":1}')
    expect(tail).toEqual([])
    expect(htmlOf(head)).toContain('1')
  })

  it('cuts at the fold and keeps every character between the halves', () => {
    const { head, tail } = foldMarks(long)
    const chars = (ms: { text?: string }[]) => ms.reduce((n, m) => n + (m.text ?? '').length, 0)
    expect(chars(head)).toBe(FOLD)
    expect(chars(head) + chars(tail)).toBe(long.length)
  })

  it('gives both sides of a straddled value the same ink', () => {
    // The whole point of cutting the MARKS rather than the string: tinting `slice(0, FOLD)`
    // on its own sees an unterminated quote and reads the rest of the line as one string.
    const { head, tail } = foldMarks(long)
    expect(head[head.length - 1]?.cls).toBe(tail[0]?.cls)
  })
})


/**
 * ⚠️ THE WINDOW USED TO BE A SUBTRACTION, and a round that calls a tool is four turns long.
 *
 * `turns.slice(-30)` landed wherever the arithmetic put it, so the conversation regularly went
 * out beginning with a `tool_result` whose `tool_use` had just been cut off. Anthropic refuses
 * a tool result following no tool use; OpenAI refuses a `tool` message answering nothing. The
 * owner read "the model did not respond", and it did not recover: the server stores what the
 * screen sends, so the next question re-cut at the same place and reopening the conversation
 * loaded the damage back. Around the eighth question, on every provider.
 */
describe('the window opens where a question begins', () => {
  const round = (n: number): Turn[] => [
    { kind: 'user', text: `q${n}` },
    { kind: 'tool_use', id: `t${n}`, name: 'list_posts', args: {} },
    { kind: 'tool_result', id: `t${n}`, name: 'list_posts', text: '[]' },
    { kind: 'assistant', text: `a${n}` },
  ]

  it('leaves a short conversation exactly as it is', () => {
    const turns = [...round(1), ...round(2)]
    expect(windowed(turns, 30)).toEqual(turns)
  })

  it('never begins on an orphan, at any window size', () => {
    const turns = Array.from({ length: 12 }, (_, i) => round(i + 1)).flat()
    // Every size across two whole rounds, so no arithmetic can be lucky.
    for (let size = 1; size <= 12; size++) {
      const cut = windowed(turns, size)
      expect(`${size}: ${cut[0]?.kind}`).toBe(`${size}: user`)
      // And what is kept is still whole: every result answers a call that is present.
      const calls = new Set(cut.filter((t) => t.kind === 'tool_use').map((t) => t.id))
      const orphans = cut.filter((t) => t.kind === 'tool_result' && !calls.has(t.id))
      expect(`${size}: ${orphans.length} orphans`).toBe(`${size}: 0 orphans`)
    }
  })

  it('drops whole exchanges rather than turns', () => {
    const turns = [...round(1), ...round(2), ...round(3)]
    // 6 asks for a window that starts mid-round-2; it opens at q3 instead.
    expect(windowed(turns, 6).map((t) => t.kind === 'user' ? t.text : t.kind))
      .toEqual(['q3', 'tool_use', 'tool_result', 'assistant'])
  })

  it('keeps a round longer than the window rather than sending a fragment of it', () => {
    const long: Turn[] = [
      { kind: 'user', text: 'big' },
      ...Array.from({ length: 8 }, (_, i) => ([
        { kind: 'tool_use', id: `b${i}`, name: 'list_posts', args: {} },
        { kind: 'tool_result', id: `b${i}`, name: 'list_posts', text: '[]' },
      ])).flat() as Turn[],
    ]
    // A window of 3 cannot be honoured without cutting the round in half, so it is not.
    expect(windowed(long, 3)).toEqual(long)
  })
})
