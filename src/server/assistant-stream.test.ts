// Folding a streamed answer, against the shapes a provider actually sends.
//
// Every payload below was recorded from a live call, because a stream is where guessing
// is most expensive: the arguments of a tool call arrive as string fragments, and a fold
// that assumed one chunk per call would produce `{"pat` and hand it to zod.

import { describe, it, expect } from 'bun:test'
import { emptyFold, foldAnthropicChunk, foldChunk, foldGeminiChunk, foldToAnswer, ssePayloads, streams } from './assistant-stream'
import { buildChat } from './assistant-dialects'

const chunk = (delta: Record<string, unknown>) => ({ choices: [{ delta }] })

describe('what streams', () => {
  it('is every provider offered, each verified against a live key', () => {
    for (const p of ['deepseek', 'openai', 'anthropic', 'gemini']) {
      expect(`${p}: ${streams(p) ? 'streams' : 'WAITS'}`).toBe(`${p}: streams`)
    }
    expect(streams('mistral')).toBe(false)
  })

  it('asks each one for a stream in its own way', () => {
    const ask = (p: string) => JSON.parse(buildChat(p, 'm', 'k', 's', [{ kind: 'user', text: 'x' }], [], { stream: true })!.body)
    expect(ask('deepseek').stream).toBe(true)
    expect(ask('anthropic').stream).toBe(true)
    // Gemini says it in the URL, and `alt=sse` is the half that is easy to forget: without
    // it the answer is a chunked JSON array that looks like a stream and parses like none.
    const url = buildChat('gemini', 'm', 'k', 's', [{ kind: 'user', text: 'x' }], [], { stream: true })!.url
    expect(url).toContain(':streamGenerateContent')
    expect(url).toContain('alt=sse')
    expect(buildChat('gemini', 'm', 'k', 's', [{ kind: 'user', text: 'x' }], [])!.url).toContain(':generateContent')
  })
})

describe('Anthropic builds its answer by block', () => {
  it('separates a tool call from the text beside it', () => {
    const fold = emptyFold()
    expect(foldAnthropicChunk(fold, { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Looking.' } })).toBe('Looking.')
    foldAnthropicChunk(fold, { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'toolu_1', name: 'list_posts' } })
    foldAnthropicChunk(fold, { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"status"' } })
    foldAnthropicChunk(fold, { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: ':"draft"}' } })
    const answer = foldToAnswer(fold)
    expect(answer.text).toBe('Looking.')
    expect(answer.calls).toEqual([{ id: 'toolu_1', name: 'list_posts', args: { status: 'draft' } }])
  })

  // An index that never opened as a tool call is a TEXT block; minting a slot for it would
  // put a nameless call in the answer.
  it('ignores json fragments for a block that is not a tool call', () => {
    const fold = emptyFold()
    foldAnthropicChunk(fold, { type: 'content_block_delta', index: 0, delta: { partial_json: '{"x":1}' } })
    expect(foldToAnswer(fold).calls).toEqual([])
  })
})

describe('Gemini sends whole parts', () => {
  it('takes a call complete, and mints the id it never sends', () => {
    const fold = emptyFold()
    expect(foldGeminiChunk(fold, { candidates: [{ content: { parts: [{ text: 'Done. ' }] } }] })).toBe('Done. ')
    foldGeminiChunk(fold, { candidates: [{ content: { parts: [{ functionCall: { name: 'update_settings', args: { path: 'title', value: 'X' } } }] } }] })
    expect(foldToAnswer(fold).calls).toEqual([{ id: 'g0', name: 'update_settings', args: { path: 'title', value: 'X' } }])
  })
})

describe('text as it lands', () => {
  it('returns each delta and accumulates the whole', () => {
    const fold = emptyFold()
    expect(foldChunk(fold, chunk({ content: 'There ' }))).toBe('There ')
    expect(foldChunk(fold, chunk({ content: 'are 3.' }))).toBe('are 3.')
    expect(foldToAnswer(fold).text).toBe('There are 3.')
  })

  it('says nothing arrived for a chunk that carried nothing', () => {
    const fold = emptyFold()
    expect(foldChunk(fold, chunk({ role: 'assistant' }))).toBe('')
    expect(foldChunk(fold, chunk({ content: '' }))).toBe('')
    expect(foldChunk(fold, { not: 'a chunk' })).toBe('')
    expect(foldToAnswer(fold).text).toBe('')
  })

  // Kept, never shown: it is what the next round has to hand back.
  it('gathers the thinking separately from the answer', () => {
    const fold = emptyFold()
    foldChunk(fold, chunk({ reasoning_content: 'The owner ' }))
    foldChunk(fold, chunk({ reasoning_content: 'asked for posts.' }))
    foldChunk(fold, chunk({ content: 'Three.' }))
    const answer = foldToAnswer(fold)
    expect(answer.reasoning).toBe('The owner asked for posts.')
    expect(answer.text).toBe('Three.')
  })
})

describe('a tool call arrives in pieces', () => {
  it('joins argument fragments before parsing them once', () => {
    const fold = emptyFold()
    foldChunk(fold, chunk({ tool_calls: [{ index: 0, id: 'c1', function: { name: 'update_settings', arguments: '' } }] }))
    for (const piece of ['{"path"', ':"features', '.search","value"', ':false}']) {
      foldChunk(fold, chunk({ tool_calls: [{ index: 0, function: { arguments: piece } }] }))
    }
    expect(foldToAnswer(fold).calls).toEqual([
      { id: 'c1', name: 'update_settings', args: { path: 'features.search', value: false } },
    ])
  })

  // The reason the fold keys on `index`: two calls interleave, and a chunk may carry a
  // fragment of the second and nothing of the first.
  it('keeps interleaved parallel calls apart, in the order the model asked', () => {
    const fold = emptyFold()
    foldChunk(fold, chunk({ tool_calls: [{ index: 0, id: 'a', function: { name: 'list_posts', arguments: '{}' } }] }))
    foldChunk(fold, chunk({ tool_calls: [{ index: 1, id: 'b', function: { name: 'list_pages', arguments: '{"x"' } }] }))
    foldChunk(fold, chunk({ tool_calls: [{ index: 1, function: { arguments: ':1}' } }] }))
    expect(foldToAnswer(fold).calls).toEqual([
      { id: 'a', name: 'list_posts', args: {} },
      { id: 'b', name: 'list_pages', args: { x: 1 } },
    ])
  })

  // A model's JSON is a guess; the tool's own schema is what refuses it a moment later.
  // What must NOT happen is the fold throwing and losing the whole answer.
  it('hands on a call whose arguments never became JSON', () => {
    const fold = emptyFold()
    foldChunk(fold, chunk({ tool_calls: [{ index: 0, id: 'c', function: { name: 'list_posts', arguments: '{"half' } }] }))
    expect(foldToAnswer(fold).calls).toEqual([{ id: 'c', name: 'list_posts', args: {} }])
  })
})

describe('the wire', () => {
  const body = (text: string) => new Response(text).body!

  const collect = async (stream: ReadableStream<Uint8Array>) => {
    const out: unknown[] = []
    for await (const payload of ssePayloads(stream)) out.push(payload)
    return out
  }

  it('reads data lines and stops at [DONE]', async () => {
    expect(await collect(body('data: {"a":1}\n\ndata: {"a":2}\n\ndata: [DONE]\n\ndata: {"a":3}\n\n')))
      .toEqual([{ a: 1 }, { a: 2 }])
  })

  it('ignores keep-alives and anything that is not an event', async () => {
    expect(await collect(body(': keep-alive\n\ndata: {"a":1}\n\n\n\n'))).toEqual([{ a: 1 }])
  })

  // The buffer's whole reason: a JSON object split across two network reads.
  it('rejoins an event that arrived in two pieces', async () => {
    const split = new ReadableStream<Uint8Array>({
      start(controller) {
        const encode = (s: string) => new TextEncoder().encode(s)
        controller.enqueue(encode('data: {"content":"hel'))
        controller.enqueue(encode('lo"}\n\ndata: [DONE]\n\n'))
        controller.close()
      },
    })
    expect(await collect(split)).toEqual([{ content: 'hello' }])
  })
})
