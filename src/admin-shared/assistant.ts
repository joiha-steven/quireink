// The assistant's vocabulary: what a conversation is made of, and the four small sums both
// faces do over it.
//
// Framework-free because ADR 0054 needs it in three places at once — the server drawing a
// transcript it read out of the database, the island drawing one that is still arriving, and
// the tests that hold those two to the same answer. Nothing here touches a DOM, a database or
// React, and `Turn` lives here rather than in `server/assistant-dialects.ts` because it was
// being re-declared, word for word, in every file that drew one.

import { leaf, txt, type Mark } from '@/admin-shared/markup'

export type Turn =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  // `reasoning` is what the model thought on its way to these calls. Only some providers hand
  // it out, and DeepSeek REFUSES the next round without it back (`echoesReasoning`), so it
  // rides on the turn rather than being dropped at the door. `at` is when the call was
  // DISPATCHED, stamped by the server so a conversation reopened from the database still
  // knows when its work happened.
  | { kind: 'tool_use'; id: string; name: string; args: Record<string, unknown>; reasoning?: string; at?: number }
  | { kind: 'tool_result'; id: string; name: string; text: string }

/** A call the server stopped in front of, waiting to be told which way. */
export type Pending = { id: string; name: string; args: Record<string, unknown>; reason?: 'listed' | 'untrusted' }

/** One question and everything that came back for it. */
export type Block = { question: string; parts: Turn[] }

/** One call and the answer that came back to it. */
export type Entry = { id: string; name: string; args: Record<string, unknown>; at?: number; result?: string }

/**
 * How much of a conversation goes back with the next question.
 *
 * The server caps what it will read at 60; this is what the screen chooses to send, and it is
 * lower on purpose — an old tool result adds cost without adding memory worth paying for.
 */
export const WINDOW = 30

/** Where the context meter turns amber: past this, one more question stops being loose change. */
export const CONTEXT_WARN = 60_000

/** Long results are folded, because one archive listing would otherwise be the whole column. */
export const FOLD = 400

/** 1,240 rather than 1240: a token count is read at a glance, not calculated with. */
export const tokens = (n: number): string =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n)

/**
 * A question opens a block and everything after it belongs to that block, so the page reads as
 * exchanges rather than as a flat list of forty turns.
 *
 * A transcript that somehow begins with an answer keeps it: dropping turns because the first
 * one is the wrong kind would lose a conversation rather than draw it oddly.
 */
export function blocksOf(turns: Turn[]): Block[] {
  const out: Block[] = []
  for (const turn of turns) {
    if (turn.kind === 'user') out.push({ question: turn.text, parts: [] })
    else if (out.length > 0) out[out.length - 1]!.parts.push(turn)
  }
  return out
}

/**
 * Calls paired with their results, oldest first.
 *
 * By `id` rather than by position: parallel calls are dispatched together and their results
 * arrive in whatever order the tools finished, so walking the list in pairs would hand a
 * settings answer to a media call about half the time.
 */
export function entriesOf(turns: Turn[]): Entry[] {
  const byId = new Map<string, Entry>()
  const order: string[] = []
  for (const t of turns) {
    if (t.kind === 'tool_use') {
      byId.set(t.id, { id: t.id, name: t.name, args: t.args, at: t.at })
      order.push(t.id)
    } else if (t.kind === 'tool_result') {
      const found = byId.get(t.id)
      if (found) found.result = t.text
    }
  }
  return order.map((id) => byId.get(id)).filter((e): e is Entry => e !== undefined)
}

/** The wall-clock time a call went out, in whichever timezone is reading it. */
export const clock = (at?: number): string =>
  at === undefined ? '' : new Date(at).toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

const JSON_KEY = 'font-medium text-neutral-800 dark:text-neutral-200'
const JSON_STR = 'text-neutral-600 dark:text-neutral-400'
const JSON_REST = 'text-neutral-400 dark:text-neutral-500'

/** A quoted string followed by a colon, i.e. a key rather than a value. */
const IS_KEY = /^"(?:[^"\\]|\\.)*"\s*:$/

/**
 * JSON, made readable WITHOUT colour.
 *
 * A syntax palette is the obvious answer and the wrong one here: this admin is monochrome plus
 * the product's own pen box, and each of those inks already means something
 * (`docs/admin-design.md` — highlighter is where-you-are, red is what-destroys). Spending four
 * new hues on a debug column would make the one screen that must be believed the one screen
 * that dresses differently from every other.
 *
 * So the same job is done with INK LEVEL and WEIGHT, which is what a reader is actually using
 * when they scan JSON: keys darkest, values mid, punctuation faintest. Deliberately not a
 * parser — a truncated result is not valid JSON and must still be shown.
 */
export function jsonMarks(text: string): Mark[] {
  const parts = text.split(/("(?:[^"\\]|\\.)*"\s*:|"(?:[^"\\]|\\.)*")/g)
  const out: Mark[] = []
  for (const piece of parts) {
    if (piece === '') continue
    if (IS_KEY.test(piece)) out.push(leaf('span', JSON_KEY, piece))
    else if (piece.startsWith('"')) out.push(leaf('span', JSON_STR, piece))
    else out.push(leaf('span', JSON_REST, piece))
  }
  // A result that is one unquoted run still needs a node, or the fold would show nothing.
  return out.length > 0 ? out : [txt('')]
}

/**
 * A long result cut in two, WITHOUT tinting it twice.
 *
 * Both halves are drawn — the tail hidden — so unfolding is one attribute and never a
 * re-render. The cut is made over the finished marks rather than over the raw string so that
 * a quoted value straddling character 400 keeps one ink on both sides of the fold: tinting
 * `text.slice(0, FOLD)` on its own would see an unterminated quote and read the rest of the
 * line as a string.
 */
export function foldMarks(text: string): { head: Mark[]; tail: Mark[] } {
  const all = jsonMarks(text)
  if (text.length <= FOLD) return { head: all, tail: [] }
  const head: Mark[] = []
  const tail: Mark[] = []
  let used = 0
  for (const m of all) {
    const len = (m.text ?? '').length
    if (used >= FOLD) { tail.push(m); continue }
    if (used + len <= FOLD) { head.push(m); used += len; continue }
    const cut = FOLD - used
    head.push({ ...m, text: (m.text ?? '').slice(0, cut) })
    tail.push({ ...m, text: (m.text ?? '').slice(cut) })
    used = FOLD
  }
  return { head, tail }
}

/** Arguments as sent. An empty object is SHOWN rather than hidden: "it called this with
 *  nothing" is a fact, and a missing line reads as a missing record. */
export const argsJson = (args: Record<string, unknown>): string => {
  try { return JSON.stringify(args) ?? '{}' } catch { return '{}' }
}
