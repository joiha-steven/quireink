// What each AI provider IS, with no opinion about how to talk to one.
//
// PURE, and imports nothing on purpose: `integration-keys.ts` needs `seesImages` to tell
// the admin whether to offer the alt-text switch, and `ai-provider.ts` needs it to refuse
// a request — but `ai-provider.ts` already reads the keys, so putting these two tables
// there would close a cycle. A file with no imports cannot be in one.

/**
 * Providers that speak OpenAI's protocol verbatim, and where each one's `/v1` lives.
 *
 * DeepSeek is not a fourth dialect: same request body, same answer shape, same `/models`
 * listing, same bearer header. Treating it as one would have meant a fourth copy of
 * `openaiMessages` — the duplication `ai-provider.ts` was split out to stop.
 */
export const OPENAI_COMPATIBLE: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
}

/**
 * Providers whose thinking models demand their own reasoning back.
 *
 * DeepSeek returns `reasoning_content` beside the tool calls, and REFUSES the next round
 * unless that field is present on the assistant message carrying them — 400, every time,
 * with `content: null` and the tool calls otherwise byte-identical. An empty string
 * satisfies it, so this is a protocol requirement rather than a quality one; the real text
 * is echoed anyway, because throwing away what the model was told to hand back is how a
 * second round starts arguing with itself.
 *
 * Narrow on purpose. The field is not part of OpenAI's own schema and is not sent there.
 */
const ECHOES_REASONING = new Set(['deepseek'])

export const echoesReasoning = (provider: string): boolean => ECHOES_REASONING.has(provider)

/**
 * The model each provider gets when the owner has not picked one.
 *
 * ⚠️ A DEFAULT IS A MODEL ID THAT EXPIRES. `gemini-2.0-flash` sat here until 2026-09-18 and
 * Google had shut it down on 2026-06-01 — announced in February, gone in June, and nothing
 * here could know. The model menu is empty until the owner presses "Load models", so this IS
 * the normal path: paste a key, press Save, and every AI job asks a model that no longer
 * exists. Three of the four fail SILENTLY (`ask()` returns null for every kind of no), so the
 * only symptom was that alt text, excerpts and the comment guard quietly stopped happening.
 *
 * Gemini stays on 2.5 rather than 3.x deliberately: from Gemini 3 onward a tool call's thought
 * signature must be echoed back or the next round is a 4xx, and nothing here carries one yet.
 *
 * `deepseek-flash` is the current name for V4.1-Flash; `deepseek-v4-flash` was retired on
 * 2026-09-10 and is still routed there, which is exactly how a dead default hides.
 */
export const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-haiku-4-5',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash',
  deepseek: 'deepseek-flash',
}

/**
 * The closed set the admin offers and the two key routes check. Derived, not typed out
 * again: a provider with no default model is a provider no job could run.
 */
export const AI_PROVIDERS: readonly string[] = Object.keys(DEFAULT_MODELS)

/**
 * WHAT TO CALL EACH ONE ON THE SCREEN.
 *
 * Here rather than in the card, and keyed by the same record the set is derived from, so the
 * menu and the set the routes accept cannot disagree: adding a provider without naming it is a
 * compile error, and naming one that does not exist is too. `ai-provider.test.ts` checked that
 * by reading the React card's `<option>` markup with a regular expression — a check that could
 * only ever notice the drift after it had shipped, and that broke the moment the card stopped
 * being JSX. Derived beats checked.
 *
 * Brand names, so they stay as they are in every language.
 */
export const AI_PROVIDER_NAMES: Record<keyof typeof DEFAULT_MODELS, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI (GPT)',
  gemini: 'Google (Gemini)',
  deepseek: 'DeepSeek',
}

/**
 * Whether a picture can be put in front of this model.
 *
 * SEEING IS A PROPERTY OF THE MODEL, NOT THE PROVIDER — the first cut of this asked only
 * the provider and was wrong within the hour: DeepSeek ships `deepseek-v4-flash` (text) and
 * `deepseek-v4-flash-vision-exp` (not) under one name and one key. Three providers are
 * listed whole because every chat model they sell can see; anywhere else it is a question
 * about the model id, and an unknown id answers no.
 *
 * Alt text is the one job that sends an image, so this decides exactly one switch. A model
 * that answers no still writes excerpts, guards comments and runs the whole assistant.
 */
const EVERY_MODEL_SEES = new Set(['anthropic', 'openai', 'gemini'])
// `flash`, not `vision`. The `-vision-exp` id this was written for was retired on 2026-09-10
// and its traffic moved to V4.1-Flash, which sees images under the plain name `deepseek-flash`
// — so the rule matched only a name nobody can choose any more, and answered NO for the one
// current model that can see. Pro cannot; the legacy `-flash` aliases all route to Flash.
const SEEING_MODEL: Record<string, RegExp> = { deepseek: /flash/i }

export function seesImages(provider: string, model = ''): boolean {
  if (EVERY_MODEL_SEES.has(provider)) return true
  const seeing = SEEING_MODEL[provider]
  return seeing ? seeing.test(model || DEFAULT_MODELS[provider] || '') : false
}
