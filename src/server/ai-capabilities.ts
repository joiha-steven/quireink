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

export const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-haiku-4-5',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
  deepseek: 'deepseek-v4-flash',
}

/**
 * The closed set the admin offers and the two key routes check. Derived, not typed out
 * again: a provider with no default model is a provider no job could run.
 */
export const AI_PROVIDERS: readonly string[] = Object.keys(DEFAULT_MODELS)

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
const SEEING_MODEL: Record<string, RegExp> = { deepseek: /vision/i }

export function seesImages(provider: string, model = ''): boolean {
  if (EVERY_MODEL_SEES.has(provider)) return true
  const seeing = SEEING_MODEL[provider]
  return seeing ? seeing.test(model || DEFAULT_MODELS[provider] || '') : false
}
