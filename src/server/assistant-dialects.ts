// Three dialects, one conversation shape. PURE — build the request, read the answer;
// the loop in `assistant.ts` owns everything stateful.
//
// The neutral shape is four kinds of turn. Each dialect folds them differently —
// Anthropic wants tool results inside a user message, OpenAI wants them as their own
// `tool` role, Gemini wants a `functionResponse` part and has no call ids at all — and
// the whole point of this file is that nothing outside it ever learns those facts.

// A name added to OPENAI_COMPATIBLE is added to every AI job at once, because
// `ai-provider.ts` reads the same table for alt text, excerpts and the comment guard.
// That is the point: one list, or a provider that works in the chat box and silently
// does nothing everywhere else.
import { OPENAI_COMPATIBLE, echoesReasoning } from '@/server/ai-capabilities'

export type Turn =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  // `reasoning` is what the model thought on its way to these calls. Only some providers
  // hand it out, and DeepSeek REFUSES the next round without it back (`echoesReasoning`),
  // so it rides on the turn rather than being dropped at the door.
  // `at` is when the call was DISPATCHED, stamped by the server so a conversation reopened
  // from the database still knows when its work happened. `reasoning` is what the model
  // thought on the way there: some providers hand it out and DeepSeek refuses the next
  // round without it back (`echoesReasoning`), so it rides on the turn rather than being
  // dropped at the door.
  | { kind: 'tool_use'; id: string; name: string; args: Record<string, unknown>; reasoning?: string; at?: number }
  | { kind: 'tool_result'; id: string; name: string; text: string }

export type ToolSpec = { name: string; description: string; parameters: Record<string, unknown> }
export type ChatRequest = { url: string; headers: Record<string, string>; body: string }
/**
 * What one round cost, in the provider's own count.
 *
 * `input` is the WHOLE conversation as the provider saw it, not just the new question, so
 * the last round's input is the context length: the number that grows every turn and the
 * one the owner needs to see before deciding to start again.
 */
export type Usage = { input: number; output: number }

export const noUsage = (): Usage => ({ input: 0, output: 0 })

export type ChatAnswer = {
  text: string
  reasoning: string
  calls: { id: string; name: string; args: Record<string, unknown> }[]
  usage: Usage
}

const cap = (s: string, n = 20_000): string => (s.length > n ? s.slice(0, n) + '\n…[truncated]' : s)

/**
 * The output ceiling for one turn of the conversation.
 *
 * It was 1500, which is generous for an answer and not generous at all for a model that
 * thinks first: measured against `deepseek-v4-flash`, a request for a 120-word paragraph
 * spent 3348 characters on `reasoning_content`, hit the ceiling, and returned
 * `finish_reason: length` with an EMPTY answer — a blank reply after ten seconds, with
 * every part of the request correct. The same ceiling emptied the alt-text job a few hours
 * earlier, from the same cause, which is what makes it worth a named constant here.
 *
 * Costs nothing on a model that does not reason: it still stops when it has answered.
 */
const ANSWER_TOKENS = 4000

// ---- Anthropic ---------------------------------------------------------------------------

function anthropicMessages(turns: Turn[]): unknown[] {
  const out: { role: string; content: unknown[] }[] = []
  for (const t of turns) {
    if (t.kind === 'user') out.push({ role: 'user', content: [{ type: 'text', text: t.text }] })
    else if (t.kind === 'assistant') out.push({ role: 'assistant', content: [{ type: 'text', text: t.text }] })
    else if (t.kind === 'tool_use') {
      const last = out[out.length - 1]
      const block = { type: 'tool_use', id: t.id, name: t.name, input: t.args }
      // Parallel calls share one assistant message; a text turn does not absorb one.
      if (last?.role === 'assistant' && (last.content as { type: string }[]).some((b) => b.type === 'tool_use')) last.content.push(block)
      else out.push({ role: 'assistant', content: [block] })
    } else {
      const last = out[out.length - 1]
      const block = { type: 'tool_result', tool_use_id: t.id, content: cap(t.text) }
      if (last?.role === 'user' && (last.content as { type: string }[]).some((b) => b.type === 'tool_result')) last.content.push(block)
      else out.push({ role: 'user', content: [block] })
    }
  }
  return out
}

// ---- OpenAI ------------------------------------------------------------------------------

function openaiMessages(system: string, turns: Turn[], echo: boolean): unknown[] {
  const out: Record<string, unknown>[] = [{ role: 'system', content: system }]
  for (const t of turns) {
    if (t.kind === 'user') out.push({ role: 'user', content: t.text })
    else if (t.kind === 'assistant') out.push({ role: 'assistant', content: t.text })
    else if (t.kind === 'tool_use') {
      const call = { id: t.id, type: 'function', function: { name: t.name, arguments: JSON.stringify(t.args) } }
      const last = out[out.length - 1]
      const reasoning = echo ? { reasoning_content: t.reasoning ?? '' } : {}
      if (last?.role === 'assistant' && Array.isArray(last.tool_calls)) {
        (last.tool_calls as unknown[]).push(call) // parallel calls share one message
      } else if (last?.role === 'assistant') {
        // NARRATION AND CALLS ARE ONE MESSAGE. A model that says "let me look" and calls a
        // tool said both in a single reply; the neutral shape splits that into two turns,
        // and emitting two assistant messages is a re-narration the provider never sent.
        // OpenAI tolerates it. DeepSeek refuses the round — intermittently, because only
        // some replies carry narration at all, which is what made it look like flakiness.
        Object.assign(last, { tool_calls: [call], ...reasoning })
      } else {
        // The empty string is not a placeholder: absent is a 400 and '' is a 200, so a
        // round whose reasoning was never returned still has to say so out loud.
        out.push({ role: 'assistant', content: null, tool_calls: [call], ...reasoning })
      }
    } else out.push({ role: 'tool', tool_call_id: t.id, content: cap(t.text) })
  }
  return out
}

// ---- Gemini ------------------------------------------------------------------------------

function geminiContents(turns: Turn[]): unknown[] {
  const out: { role: string; parts: unknown[] }[] = []
  const push = (role: string, part: unknown, merge: boolean) => {
    const last = out[out.length - 1]
    if (merge && last?.role === role) last.parts.push(part)
    else out.push({ role, parts: [part] })
  }
  for (const t of turns) {
    if (t.kind === 'user') push('user', { text: t.text }, false)
    else if (t.kind === 'assistant') push('model', { text: t.text }, false)
    else if (t.kind === 'tool_use') push('model', { functionCall: { name: t.name, args: t.args } }, true)
    else push('user', { functionResponse: { name: t.name, response: { result: cap(t.text) } } }, true)
  }
  return out
}

/**
 * Gemini's schema reader is the fussiest of the four, and this used to be a one-line strip.
 *
 * IT NEVER WORKED. Every call was refused — `Unknown name "const"` — so the whole provider
 * was dead in the chat box, before streaming and regardless of it. Nothing caught it
 * because a schema is only judged by the provider, and there was no Gemini key here until
 * today. zod writes a literal as `{const: x}` and a union of literals as an `anyOf` of
 * them; Gemini knows `enum` and not `const`, and rejects the request rather than ignoring
 * a word it does not recognise.
 *
 * So: recursive, and every rewrite below is a shape zod actually emits for these 42 tools.
 */
/**
 * A fixed set of allowed values, in the only form Gemini takes.
 *
 * `enum` is STRINGS ONLY there — a numeric union (`7 | 30 | 90`, the analytics windows)
 * is refused with "Invalid value … (TYPE_STRING), 7". So numbers keep their type and the
 * choice moves into the description, which the model reads anyway; making them strings
 * instead would have the model send "7" to a tool whose zod schema wants 7.
 */
function allowed(values: unknown[]): Record<string, unknown> {
  const first = values[0]
  if (typeof first === 'string') return { type: 'string', enum: values }
  return {
    type: typeof first === 'number' ? 'number' : typeof first === 'boolean' ? 'boolean' : 'string',
    description: `One of: ${values.join(', ')}`,
  }
}

function geminiParams(schema: Record<string, unknown>): Record<string, unknown> {
  const { $schema: _s, additionalProperties: _a, ...rest } = schema
  const out: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(rest)) {
    if (key === 'const') {
      Object.assign(out, allowed([value]))
    } else if (key === 'anyOf' && Array.isArray(value)) {
      const members = value as Record<string, unknown>[]
      // `'draft' | 'published'` reaches here as two consts. Collapsed, it is the enum
      // Gemini was going to be given anyway — kept as anyOf it is two words it refuses.
      if (members.length > 0 && members.every((m) => 'const' in m)) {
        Object.assign(out, allowed(members.map((m) => m.const)))
      } else {
        out.anyOf = members.map(geminiParams)
      }
    } else if (key === 'properties' && value && typeof value === 'object') {
      out.properties = Object.fromEntries(
        Object.entries(value as Record<string, Record<string, unknown>>)
          .map(([name, sub]) => [name, geminiParams(sub)]),
      )
    } else if (key === 'items' && value && typeof value === 'object') {
      out.items = geminiParams(value as Record<string, unknown>)
    } else if (key === 'description' && typeof out.description === 'string') {
      // `allowed()` may already have written one; the tool's own words come first.
      out.description = `${String(value)} ${out.description}`
    } else {
      out[key] = value
    }
  }
  return out
}

// ---- one front door ------------------------------------------------------------------------

export function buildChat(
  provider: string, model: string, key: string,
  system: string, turns: Turn[], tools: ToolSpec[],
  // Streaming is the same request with one flag. Only the OpenAI-compatible branch reads
  // it: `assistant-stream.ts` says why the other two are not offered it.
  opts: { stream?: boolean } = {},
): ChatRequest | null {
  if (provider === 'anthropic') {
    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model, max_tokens: ANSWER_TOKENS, system,
        ...(opts.stream ? { stream: true } : {}),
        messages: anthropicMessages(turns),
        tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
      }),
    }
  }
  const base = OPENAI_COMPATIBLE[provider]
  if (base) {
    return {
      url: `${base}/chat/completions`,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model, max_tokens: ANSWER_TOKENS,
        // `include_usage` is opt-in and silently absent without it, so a streamed answer
        // would report a cost of zero while a whole-answer one reported the truth.
        ...(opts.stream ? { stream: true, stream_options: { include_usage: true } } : {}),
        messages: openaiMessages(system, turns, echoesReasoning(provider)),
        tools: tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
      }),
    }
  }
  if (provider === 'gemini') {
    return {
      // `?alt=sse` is not optional for the streaming call: without it Gemini answers a
      // JSON ARRAY that arrives in chunks, which looks like a stream and parses like
      // nothing.
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${
        opts.stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: geminiContents(turns),
        tools: [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: geminiParams(t.parameters) })) }],
      }),
    }
  }
  return null
}

/** A count, or zero. Providers omit the field on some answers rather than sending 0. */
export const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export function parseChat(provider: string, json: unknown): ChatAnswer {
  const j = json as Record<string, any>
  const out: ChatAnswer = { text: '', reasoning: '', calls: [], usage: noUsage() }
  if (provider === 'anthropic') {
    out.usage = { input: num(j?.usage?.input_tokens), output: num(j?.usage?.output_tokens) }
    for (const b of j?.content ?? []) {
      if (b.type === 'text') out.text += b.text
      else if (b.type === 'tool_use') out.calls.push({ id: String(b.id), name: String(b.name), args: b.input ?? {} })
    }
  } else if (OPENAI_COMPATIBLE[provider]) {
    out.usage = { input: num(j?.usage?.prompt_tokens), output: num(j?.usage?.completion_tokens) }
    const m = j?.choices?.[0]?.message
    out.text = typeof m?.content === 'string' ? m.content : ''
    if (typeof m?.reasoning_content === 'string') out.reasoning = m.reasoning_content
    for (const c of m?.tool_calls ?? []) {
      let args: Record<string, unknown> = {}
      try { args = JSON.parse(c?.function?.arguments ?? '{}') } catch { /* refused below by zod */ }
      out.calls.push({ id: String(c.id), name: String(c?.function?.name ?? ''), args })
    }
  } else if (provider === 'gemini') {
    out.usage = { input: num(j?.usageMetadata?.promptTokenCount), output: num(j?.usageMetadata?.candidatesTokenCount) }
    let n = 0
    for (const p of j?.candidates?.[0]?.content?.parts ?? []) {
      if (typeof p?.text === 'string') out.text += p.text
      // Gemini has no call ids; mint stable ones so the result turns can answer them.
      else if (p?.functionCall) out.calls.push({ id: `g${n++}`, name: String(p.functionCall.name ?? ''), args: p.functionCall.args ?? {} })
    }
  }
  out.text = out.text.trim()
  return out
}
