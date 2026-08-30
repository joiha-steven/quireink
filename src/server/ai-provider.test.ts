// The provider table, which is the one place a fourth name could go wrong quietly.
//
// Adding DeepSeek is four lines of table and no new dialect, and that is exactly why it
// needs pinning: the failure mode of a shared code path is a name that reaches the admin
// menu, saves fine, and then does nothing — because one of the five branches that switch
// on the provider was never widened. So the tests below walk the WHOLE list rather than
// naming a provider, and a fifth one inherits them for free.

import { describe, it, expect } from 'bun:test'
import { AI_PROVIDERS, DEFAULT_MODELS, buildParts, parseText, seesImages } from './ai-provider'
import { buildChat, parseChat, type Turn } from './assistant-dialects'

const TEXT = [{ text: 'describe this' }]
const IMAGE = [{ text: 'describe this' }, { imageMime: 'image/png', imageB64: 'AAA' }]

describe('the closed set', () => {
  it('offers only names that every branch can actually serve', () => {
    for (const p of AI_PROVIDERS) {
      expect(`${p}: model`).toBe(`${p}: ${DEFAULT_MODELS[p] ? 'model' : 'MISSING'}`)
      expect(`${p}: parts`).toBe(`${p}: ${buildParts(p, 'm', 'k', TEXT) ? 'parts' : 'NULL'}`)
      expect(`${p}: chat`).toBe(`${p}: ${buildChat(p, 'm', 'k', 's', [{ kind: 'user', text: 'x' }], []) ? 'chat' : 'NULL'}`)
    }
  })

  it('refuses a name that is not on it', () => {
    expect(buildParts('mistral', 'm', 'k', TEXT)).toBeNull()
    expect(buildChat('mistral', 'm', 'k', 's', [{ kind: 'user', text: 'x' }], [])).toBeNull()
  })

  // The menu the owner sees and the set the server accepts are written in different files
  // and different languages. A provider in one and not the other is either a dead option
  // or an unreachable feature, and neither announces itself.
  it('the admin menu names exactly this set', async () => {
    const source = await Bun.file('src/admin/components/AiFields.tsx').text()
    const offered = [...source.matchAll(/<option value="([a-z]*)"/g)].map((m) => m[1]).filter(Boolean)
    expect(offered.sort()).toEqual([...AI_PROVIDERS].sort())
  })
})

describe('DeepSeek rides in OpenAI\'s dialect', () => {
  it('sends an OpenAI body to DeepSeek\'s own host', () => {
    const chat = buildChat('deepseek', 'deepseek-v4-flash', 'k', 'sys', [{ kind: 'user', text: 'hi' }], [])!
    expect(chat.url).toBe('https://api.deepseek.com/v1/chat/completions')
    expect(chat.headers.authorization).toBe('Bearer k')
    // The shape is OpenAI's, not a third thing: system is a message, not a field.
    expect(JSON.parse(chat.body).messages[0]).toEqual({ role: 'system', content: 'sys' })

    const parts = buildParts('deepseek', 'deepseek-v4-flash', 'k', TEXT)!
    expect(parts.url).toBe('https://api.deepseek.com/v1/chat/completions')
  })

  it('is read back by the same parser', () => {
    const answer = { choices: [{ message: { content: 'ok', tool_calls: [{ id: 'c1', function: { name: 'n', arguments: '{}' } }] } }] }
    expect(parseChat('deepseek', answer)).toEqual({ text: 'ok', reasoning: '', calls: [{ id: 'c1', name: 'n', args: {} }] })
    expect(parseText('deepseek', { choices: [{ message: { content: ' hi ' } }] })).toBe('hi')
  })
})

describe('a thinking model gets its own thoughts back', () => {
  // Not a nicety: DeepSeek answers 400 on the round AFTER a tool call unless the assistant
  // message carrying that call also carries `reasoning_content`. Measured three times each
  // way — absent is 400 every time, present (even as '') is 200 every time. It cost a
  // working feature that had already passed 2488 tests, because nothing in a unit test can
  // see the second round of a conversation with a real provider.
  const CALLED: Turn[] = [
    { kind: 'user', text: 'hi' },
    { kind: 'tool_use', id: 'a1', name: 'list_posts', args: {}, reasoning: 'The owner asked.' },
    { kind: 'tool_result', id: 'a1', name: 'list_posts', text: '[]' },
  ]
  const assistantMessage = (provider: string) =>
    JSON.parse(buildChat(provider, 'm', 'k', 's', CALLED, [])!.body)
      .messages.find((m: { tool_calls?: unknown }) => m.tool_calls)

  it('echoes it to the provider that demands it', () => {
    expect(assistantMessage('deepseek').reasoning_content).toBe('The owner asked.')
  })

  it('sends the field even when the model returned no reasoning, because absent is the 400', () => {
    const noReasoning: Turn[] = [CALLED[0]!, { kind: 'tool_use', id: 'a1', name: 'list_posts', args: {} }, CALLED[2]!]
    const message = JSON.parse(buildChat('deepseek', 'm', 'k', 's', noReasoning, [])!.body)
      .messages.find((m: { tool_calls?: unknown }) => m.tool_calls)
    expect(message.reasoning_content).toBe('')
  })

  // It is not part of OpenAI's schema, and this file's whole job is that a quirk of one
  // provider does not leak into the request built for another.
  it('never sends it to OpenAI', () => {
    expect('reasoning_content' in assistantMessage('openai')).toBe(false)
  })

  // The bug this pins looked like flakiness for an hour: 502, 200, 502 on the same prompt.
  // The model only sometimes narrates before calling a tool, and when it did, the neutral
  // shape's two turns became two assistant messages — the second carrying the calls, the
  // first carrying nothing DeepSeek would accept. One reply from the model is one message.
  it('folds narration and the calls it came with into ONE message', () => {
    const narrated: Turn[] = [
      { kind: 'user', text: 'hi' },
      { kind: 'assistant', text: 'Let me look.' },
      { kind: 'tool_use', id: 'a1', name: 'list_posts', args: {}, reasoning: 'thinking' },
      { kind: 'tool_result', id: 'a1', name: 'list_posts', text: '[]' },
    ]
    const messages = JSON.parse(buildChat('deepseek', 'm', 'k', 's', narrated, [])!.body).messages
    const assistants = messages.filter((m: { role: string }) => m.role === 'assistant')
    expect(assistants).toHaveLength(1)
    expect(assistants[0].content).toBe('Let me look.')
    expect(assistants[0].tool_calls).toHaveLength(1)
    expect(assistants[0].reasoning_content).toBe('thinking')
  })

  // A finished answer is not narration: the next question's calls belong to a new reply.
  it('does not let a closed answer absorb the next round\'s calls', () => {
    const twoExchanges: Turn[] = [
      { kind: 'user', text: 'hi' },
      { kind: 'assistant', text: 'There is one draft.' },
      { kind: 'user', text: 'and now?' },
      { kind: 'tool_use', id: 'b1', name: 'list_posts', args: {} },
    ]
    const messages = JSON.parse(buildChat('deepseek', 'm', 'k', 's', twoExchanges, [])!.body).messages
    expect(messages.filter((m: { role: string }) => m.role === 'assistant')).toHaveLength(2)
    expect(messages.find((m: { content: string }) => m.content === 'There is one draft.').tool_calls).toBeUndefined()
  })

  it('reads it back off the wire', () => {
    const answered = { choices: [{ message: { content: '', reasoning_content: 'thinking…', tool_calls: [] } }] }
    expect(parseChat('deepseek', answered).reasoning).toBe('thinking…')
    expect(parseChat('openai', answered).reasoning).toBe('thinking…')
  })
})

describe('the output ceiling', () => {
  // A number, pinned, because the failure it prevents is invisible: a reasoning model
  // spends the budget thinking and returns `content: ""` with `finish_reason: length`,
  // so the job produces nothing while the key, the model and the request are all right.
  // Measured at 300 against `deepseek-v4-flash-vision-exp`: empty every time.
  it('leaves room for a model that thinks before it answers', () => {
    for (const p of ['anthropic', 'openai', 'deepseek']) {
      const body = JSON.parse(buildParts(p, 'm', 'k', TEXT)!.body)
      expect(`${p}: ${body.max_tokens >= 1000 ? 'roomy' : `only ${body.max_tokens}`}`).toBe(`${p}: roomy`)
    }
  })
})

describe('seeing is a property of the MODEL', () => {
  // The first cut of this asked only the provider, and was wrong the same day: DeepSeek
  // sells a text model and a vision model under one name and one key. Anything that
  // answers per-provider gets one of the two wrong, and neither error announces itself —
  // the text model would be sent pictures, or the vision model would be refused them.
  it('splits one provider by its model id', () => {
    expect(seesImages('deepseek', 'deepseek-v4-flash')).toBe(false)
    expect(seesImages('deepseek', 'deepseek-v4-flash-vision-exp')).toBe(true)
    expect(buildParts('deepseek', 'deepseek-v4-flash', 'k', IMAGE)).toBeNull()
    expect(buildParts('deepseek', 'deepseek-v4-flash-vision-exp', 'k', IMAGE)).not.toBeNull()
    // ...and the text model still answers about text, which is the other three jobs.
    expect(buildParts('deepseek', 'deepseek-v4-flash', 'k', TEXT)).not.toBeNull()
  })

  it('an unknown model on such a provider answers no, not yes', () => {
    expect(seesImages('deepseek', 'something-new')).toBe(false)
    expect(seesImages('deepseek', '')).toBe(false) // '' falls back to the default, text
  })

  it('leaves whole-provider families alone, whatever the model is called', () => {
    for (const p of ['anthropic', 'openai', 'gemini']) {
      expect(`${p}: sees`).toBe(`${p}: ${seesImages(p, 'anything-at-all') ? 'sees' : 'BLIND'}`)
      expect(`${p}: sends`).toBe(`${p}: ${buildParts(p, 'm', 'k', IMAGE) ? 'sends' : 'REFUSED'}`)
    }
  })
})
