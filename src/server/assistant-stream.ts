// Reading an answer while it is still being written.
//
// The non-streaming path asks once and waits for the whole reply, which for a model that
// thinks first is fifteen seconds of a motionless screen. Same request, `stream: true`,
// and the words arrive as the model produces them.
//
// THREE SHAPES. The OpenAI family sends `choices[].delta`; Anthropic sends named events
// and builds each content block by index, a tool call's arguments arriving as
// `partial_json`; Gemini sends whole `candidates[].content.parts` and needs `?alt=sse` or
// it answers with a JSON array instead of a stream. All three fold into the one ChatAnswer
// the rest of the loop already knows, and all three were verified against a live key —
// which is the only kind of verification this layer accepts, after a week in which DeepSeek
// passed 2488 tests and was still broken in four places only a real call could show.
//
// PURE except for the reader at the bottom: the folding is a function of (state, chunk),
// so every shape below is tested against recorded payloads rather than a live provider.

import { noUsage, num, type ChatAnswer, type Usage } from '@/server/assistant-dialects'
import { OPENAI_COMPATIBLE } from '@/server/ai-capabilities'

/** Whether this provider's answers can be read as they arrive. */
export const streams = (provider: string): boolean =>
  OPENAI_COMPATIBLE[provider] !== undefined || provider === 'anthropic' || provider === 'gemini'

/** A tool call arrives in fragments: the name in one chunk, its arguments over several. */
type Building = { id: string; name: string; args: string }

export type StreamFold = {
  text: string
  reasoning: string
  building: Map<number, Building>
  /**
   * The count arrives ONCE, in its own chunk, at a different moment for each provider:
   * OpenAI puts it in a final chunk with no choices, Anthropic splits it over the first
   * and last events, Gemini repeats a running total on every chunk. So it is assigned
   * rather than accumulated, and a later number replaces an earlier one.
   */
  usage: Usage
}

export const emptyFold = (): StreamFold =>
  ({ text: '', reasoning: '', building: new Map(), usage: noUsage() })

/**
 * One SSE payload folded in. Returns the text that just landed, for the screen.
 *
 * Arguments accumulate as a STRING and are parsed once at the end. A half-arrived
 * `{"path":"features.sea` is not JSON, and a fold that tried to parse every fragment would
 * spend the whole call throwing.
 */
export function foldChunk(fold: StreamFold, payload: unknown): string {
  const chunk = payload as {
    choices?: { delta?: Record<string, unknown> }[]
    usage?: { prompt_tokens?: unknown; completion_tokens?: unknown }
  }
  // The usage chunk carries no choices at all, so this has to be read before the guard.
  if (chunk?.usage) {
    fold.usage = { input: num(chunk.usage.prompt_tokens), output: num(chunk.usage.completion_tokens) }
  }
  const delta = chunk?.choices?.[0]?.delta
  if (!delta) return ''

  let arrived = ''
  if (typeof delta.content === 'string' && delta.content !== '') {
    fold.text += delta.content
    arrived = delta.content
  }
  // The thinking, kept but not shown: the provider demands it back on the next round.
  if (typeof delta.reasoning_content === 'string') fold.reasoning += delta.reasoning_content

  const calls = Array.isArray(delta.tool_calls) ? delta.tool_calls : []
  for (const raw of calls) {
    const c = raw as { index?: number; id?: string; function?: { name?: string; arguments?: string } }
    // By INDEX, not by position in this chunk: parallel calls interleave, and a chunk may
    // carry a fragment of the second call and nothing of the first.
    const at = typeof c.index === 'number' ? c.index : 0
    const slot = fold.building.get(at) ?? { id: '', name: '', args: '' }
    if (c.id) slot.id = c.id
    if (c.function?.name) slot.name += c.function.name
    if (c.function?.arguments) slot.args += c.function.arguments
    fold.building.set(at, slot)
  }
  return arrived
}

/** The finished answer, in the shape the non-streaming path returns. */
export function foldToAnswer(fold: StreamFold): ChatAnswer {
  return {
    text: fold.text.trim(),
    reasoning: fold.reasoning,
    usage: fold.usage,
    calls: [...fold.building.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, b]) => {
        let args: Record<string, unknown> = {}
        // Same shrug as the non-streaming parser: a model's JSON is a guess, and the
        // tool's own zod schema is what refuses it a moment later.
        try { args = JSON.parse(b.args || '{}') as Record<string, unknown> } catch { /* refused downstream */ }
        return { id: b.id, name: b.name, args }
      })
      .filter((c) => c.name),
  }
}

/**
 * The same fold, from Anthropic's named events.
 *
 * A block is opened by `content_block_start` (which carries a tool call's id and name) and
 * filled by `content_block_delta`. Text and tool calls share one index space, so the fold
 * keeps them apart by what the opening event said the block was.
 */
export function foldAnthropicChunk(fold: StreamFold, payload: unknown): string {
  const p = payload as {
    type?: string
    index?: number
    content_block?: { type?: string; id?: string; name?: string }
    delta?: { type?: string; text?: string; partial_json?: string }
  }
  const at = typeof p.index === 'number' ? p.index : 0

  // Split across the first and last events: the prompt is counted before a word is
  // written, the output only once it has stopped.
  if (p.type === 'message_start') {
    fold.usage.input = num((p as { message?: { usage?: { input_tokens?: unknown } } }).message?.usage?.input_tokens)
  }
  if (p.type === 'message_delta') {
    const out = (p as { usage?: { output_tokens?: unknown } }).usage?.output_tokens
    if (out !== undefined) fold.usage.output = num(out)
  }

  if (p.type === 'content_block_start' && p.content_block?.type === 'tool_use') {
    fold.building.set(at, { id: p.content_block.id ?? '', name: p.content_block.name ?? '', args: '' })
    return ''
  }
  if (p.type !== 'content_block_delta' || !p.delta) return ''

  if (typeof p.delta.text === 'string' && p.delta.text !== '') {
    fold.text += p.delta.text
    return p.delta.text
  }
  // Only for a block that opened as a tool call: an index with no slot is a text block,
  // and inventing one for it would put an empty call in the answer.
  if (typeof p.delta.partial_json === 'string') {
    const slot = fold.building.get(at)
    if (slot) slot.args += p.delta.partial_json
  }
  return ''
}

/**
 * The same fold, from Gemini's parts.
 *
 * Gemini streams WHOLE parts rather than fragments — a `functionCall` arrives with its
 * arguments already an object — so nothing accumulates except the running index, which
 * this fold mints itself because Gemini gives its calls no ids at all (the same absence
 * `parseChat` covers for the non-streaming path).
 */
export function foldGeminiChunk(fold: StreamFold, payload: unknown): string {
  const meta = (payload as { usageMetadata?: { promptTokenCount?: unknown; candidatesTokenCount?: unknown } })?.usageMetadata
  // A running total on every chunk, so the last one wins rather than being added.
  if (meta) fold.usage = { input: num(meta.promptTokenCount), output: num(meta.candidatesTokenCount) }

  const parts = (payload as { candidates?: { content?: { parts?: unknown[] } }[] })
    ?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return ''

  let arrived = ''
  for (const raw of parts) {
    const part = raw as { text?: string; functionCall?: { name?: string; args?: Record<string, unknown> } }
    if (typeof part.text === 'string' && part.text !== '') {
      fold.text += part.text
      arrived += part.text
    }
    if (part.functionCall?.name) {
      const at = fold.building.size
      fold.building.set(at, {
        id: `g${at}`,
        name: part.functionCall.name,
        args: JSON.stringify(part.functionCall.args ?? {}),
      })
    }
  }
  return arrived
}

/**
 * Split a byte stream into SSE payloads.
 *
 * Chunk boundaries fall wherever the network puts them, so a JSON object routinely arrives
 * in two pieces — the buffer is the whole point. `[DONE]` ends it; anything that is not a
 * `data:` line (comments, the blank keep-alives) is skipped.
 */
export async function* ssePayloads(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const decoder = new TextDecoder()
  let buffer = ''
  const reader = body.getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let cut = buffer.indexOf('\n')
      while (cut !== -1) {
        const line = buffer.slice(0, cut).trim()
        buffer = buffer.slice(cut + 1)
        cut = buffer.indexOf('\n')
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') return
        try { yield JSON.parse(data) } catch { /* a truncated keep-alive, not an answer */ }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/** Consume the response, announcing text as it lands, and return the finished answer. */
export async function readChatStream(
  provider: string, res: Response, onText: (delta: string) => void,
): Promise<ChatAnswer> {
  const fold = emptyFold()
  const foldOne = provider === 'anthropic' ? foldAnthropicChunk
    : provider === 'gemini' ? foldGeminiChunk
    : foldChunk
  if (res.body) {
    for await (const payload of ssePayloads(res.body)) {
      const arrived = foldOne(fold, payload)
      if (arrived) onText(arrived)
    }
  }
  return foldToAnswer(fold)
}
