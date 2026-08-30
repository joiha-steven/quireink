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
import { OPENAI_COMPATIBLE } from '@/server/ai-capabilities'

export type Turn =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool_use'; id: string; name: string; args: Record<string, unknown> }
  | { kind: 'tool_result'; id: string; name: string; text: string }

export type ToolSpec = { name: string; description: string; parameters: Record<string, unknown> }
export type ChatRequest = { url: string; headers: Record<string, string>; body: string }
export type ChatAnswer = { text: string; calls: { id: string; name: string; args: Record<string, unknown> }[] }

const cap = (s: string, n = 20_000): string => (s.length > n ? s.slice(0, n) + '\n…[truncated]' : s)

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

function openaiMessages(system: string, turns: Turn[]): unknown[] {
  const out: Record<string, unknown>[] = [{ role: 'system', content: system }]
  for (const t of turns) {
    if (t.kind === 'user') out.push({ role: 'user', content: t.text })
    else if (t.kind === 'assistant') out.push({ role: 'assistant', content: t.text })
    else if (t.kind === 'tool_use') {
      const call = { id: t.id, type: 'function', function: { name: t.name, arguments: JSON.stringify(t.args) } }
      const last = out[out.length - 1]
      if (last?.role === 'assistant' && Array.isArray(last.tool_calls)) (last.tool_calls as unknown[]).push(call)
      else out.push({ role: 'assistant', content: null, tool_calls: [call] })
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

// Gemini's schema reader is the fussiest of the three: no $schema, no additionalProperties.
function geminiParams(p: Record<string, unknown>): Record<string, unknown> {
  const { $schema: _s, additionalProperties: _a, ...rest } = p
  return rest
}

// ---- one front door ------------------------------------------------------------------------

export function buildChat(
  provider: string, model: string, key: string,
  system: string, turns: Turn[], tools: ToolSpec[],
): ChatRequest | null {
  if (provider === 'anthropic') {
    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model, max_tokens: 1500, system,
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
        model, max_tokens: 1500,
        messages: openaiMessages(system, turns),
        tools: tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
      }),
    }
  }
  if (provider === 'gemini') {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
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

export function parseChat(provider: string, json: unknown): ChatAnswer {
  const j = json as Record<string, any>
  const out: ChatAnswer = { text: '', calls: [] }
  if (provider === 'anthropic') {
    for (const b of j?.content ?? []) {
      if (b.type === 'text') out.text += b.text
      else if (b.type === 'tool_use') out.calls.push({ id: String(b.id), name: String(b.name), args: b.input ?? {} })
    }
  } else if (OPENAI_COMPATIBLE[provider]) {
    const m = j?.choices?.[0]?.message
    out.text = typeof m?.content === 'string' ? m.content : ''
    for (const c of m?.tool_calls ?? []) {
      let args: Record<string, unknown> = {}
      try { args = JSON.parse(c?.function?.arguments ?? '{}') } catch { /* refused below by zod */ }
      out.calls.push({ id: String(c.id), name: String(c?.function?.name ?? ''), args })
    }
  } else if (provider === 'gemini') {
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
