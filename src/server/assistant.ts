// The in-admin assistant: the second door onto the one tool registry.
//
// Somebody with a Claude subscription connects over MCP and never needs this. Somebody
// who plugged an API key into Settings → AI gets the same steward INSIDE the admin: a
// chat box whose every ability is a tool from `mcp/registry.ts`, executed here on the
// server, under the owner's session, logged like every other action. One list, two
// doors, one rulebook — the assistant cannot do anything MCP cannot, by construction.
//
// The loop is deliberately small: up to MAX_ROUNDS tool rounds per message, arguments
// validated against each tool's own zod schema before the handler runs (a model's JSON
// is a guess, not a contract), results truncated before they ride back. This is the
// pocket assistant, and the docs say so: short memory, no web, as clever as the model
// the owner chose.

import { z } from 'zod'
import { collectTools, type ToolDef } from '@/mcp/registry'
import { getIntegrationKeys } from '@/store/integration-keys'
import { getSettings } from '@/content/settings'
import { DEFAULT_MODELS } from '@/server/ai-provider'
import { languageName } from '@/media/alt-text'
import { buildChat, parseChat, type ToolSpec, type Turn } from '@/server/assistant-dialects'
import { readChatStream, streams } from '@/server/assistant-stream'

export type { Turn }

const MAX_ROUNDS = 8
const MAX_TURNS = 60 // history the server will accept; the UI trims sooner
const RESULT_CAP = 20_000

function toSpec(def: ToolDef): ToolSpec {
  const shape = def.meta.inputSchema ?? {}
  // zod v4 speaks JSON Schema natively; `io: 'input'` because a tool's schema describes
  // what the model may SEND. Optionals stay optional instead of becoming `| undefined`.
  const schema = z.toJSONSchema(z.object(shape), { io: 'input' }) as Record<string, unknown>
  delete schema.$schema
  return { name: def.name, description: def.meta.description, parameters: schema }
}

function systemPrompt(language: string, title: string): string {
  return [
    `You are the built-in assistant of "${title}", a Quire Ink blog, talking to its OWNER inside the admin.`,
    'You act through the provided tools — the same surface an MCP agent gets, with the same limits: deletes go to the Trash, the real newsletter broadcast does not exist here, subscriber addresses are not available.',
    `Answer in ${languageName(language)} unless the owner writes in another language. Be brief and concrete; report what you actually did.`,
    // Anything this writes can end up on the blog, so it writes like the person whose blog
    // it is. The dash is named for the same reason it is named in the excerpt prompt: it is
    // the single punctuation mark that makes a paragraph read as machine-written.
    'When you write anything for publication (a post, an excerpt, a page), write it as a person would, in the blog\'s own voice. Never use em dashes or en dashes; a comma, a full stop or a colon does the same work without sounding machine-written.',
    'For clearly destructive or bulk actions, state what you are about to do and ask once before doing it.',
  ].join('\n')
}

async function runTool(def: ToolDef | undefined, args: Record<string, unknown>): Promise<string> {
  if (!def) return 'Error: no such tool.'
  const parsed = z.object(def.meta.inputSchema ?? {}).safeParse(args)
  if (!parsed.success) return `Error: invalid arguments — ${parsed.error.issues[0]?.message ?? 'schema mismatch'}`
  try {
    const result = await def.handler(parsed.data as Record<string, unknown>)
    const text = (result.content as { type: string; text?: string }[])
      .map((b) => (b.type === 'text' ? b.text ?? '' : ''))
      .join('\n')
    return text.slice(0, RESULT_CAP) || '(empty result)'
  } catch (error) {
    return `Error: ${(error as Error).message}`
  }
}

export type AssistantReply =
  | { ok: true; turns: Turn[]; text: string }
  | { ok: false; error: 'ai_not_configured' | 'bad_conversation' | 'provider_error' }

/**
 * One owner message in, a finished exchange out: the tool rounds the model asked for,
 * executed and appended, ending in its text answer. The caller stores nothing — the
 * conversation lives in the owner's open tab, which is exactly as long as it should.
 */
export async function runAssistant(turns: Turn[], onText?: (delta: string) => void): Promise<AssistantReply> {
  const keys = await getIntegrationKeys()
  if (!keys.aiProvider || !keys.aiApiKey) return { ok: false, error: 'ai_not_configured' }
  const model = keys.aiModel || DEFAULT_MODELS[keys.aiProvider]
  if (!model) return { ok: false, error: 'ai_not_configured' }
  if (turns.length === 0 || turns.length > MAX_TURNS) return { ok: false, error: 'bad_conversation' }

  const { language, title } = await getSettings()
  const system = systemPrompt(language, title)
  const defs = await collectTools()
  const byName = new Map(defs.map((d) => [d.name, d]))
  const specs = defs.map(toSpec)

  const added: Turn[] = []
  const all = () => [...turns, ...added]

  for (let round = 0; round <= MAX_ROUNDS; round++) {
    // Stream only when somebody is watching AND the provider's stream is one we have
    // actually verified. A caller with no `onText` (a test, a future job) takes the plain
    // path, which is unchanged.
    const streaming = onText !== undefined && streams(keys.aiProvider)
    const req = buildChat(keys.aiProvider, model, keys.aiApiKey, system, all(), specs, { stream: streaming })
    if (!req) return { ok: false, error: 'ai_not_configured' }
    let answer
    try {
      const res = await fetch(req.url, {
        method: 'POST', headers: req.headers, body: req.body,
        signal: AbortSignal.timeout(60_000),
      })
      if (!res.ok) {
        // The REASON, not just the number. A provider's 400 says which message it objected
        // to and why; without it the admin shows "check your key" for a refusal that has
        // nothing to do with the key, and the only way to find out is to rebuild the
        // request by hand outside the server. That cost an afternoon once already.
        const why = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300)
        console.error(`[ERROR] assistant: ${keys.aiProvider} answered ${res.status} ${why}`)
        return { ok: false, error: 'provider_error' }
      }
      answer = streaming
        ? await readChatStream(keys.aiProvider, res, onText)
        : parseChat(keys.aiProvider, await res.json())
    } catch (error) {
      console.error(`[ERROR] assistant: ${(error as Error).message}`)
      return { ok: false, error: 'provider_error' }
    }

    if (answer.calls.length === 0 || round === MAX_ROUNDS) {
      // NOTHING AT ALL is a failure, not an answer. A model that spends its whole output
      // ceiling thinking returns `finish_reason: length` with empty content, and reporting
      // that as a successful reply paints a blank panel after ten seconds and logs nothing.
      // Only on the first round: later rounds have tool results worth keeping.
      if (!answer.text && added.length === 0) {
        console.error(`[ERROR] assistant: ${keys.aiProvider} answered with no text and no tool call`)
        return { ok: false, error: 'provider_error' }
      }
      // The cap answers with whatever text there is rather than a dead end — the owner
      // sees how far it got, and every executed tool is already in the log.
      if (answer.text) added.push({ kind: 'assistant', text: answer.text })
      return { ok: true, turns: added, text: answer.text }
    }

    for (const call of answer.calls) {
      // The reasoning rides with the calls because that is where the provider wants it
      // back: DeepSeek refuses the round after this one if the assistant message carrying
      // these calls arrives without it. Empty for every provider that does not send any.
      added.push({ kind: 'tool_use', id: call.id, name: call.name, args: call.args, reasoning: answer.reasoning })
    }
    for (const call of answer.calls) {
      const text = await runTool(byName.get(call.name), call.args)
      added.push({ kind: 'tool_result', id: call.id, name: call.name, text })
    }
    if (answer.text) {
      // Interim narration between tool rounds is worth keeping for the transcript.
      added.splice(added.length - answer.calls.length * 2, 0, { kind: 'assistant', text: answer.text })
    }
  }
  return { ok: false, error: 'provider_error' }
}
