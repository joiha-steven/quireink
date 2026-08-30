// The assistant's conversations, kept (ADR 0040).
//
// Deliberately small. A chat is written whole and read whole, never queried into, so there
// is one row per conversation with the turns as a JSON document and no join anywhere. The
// screen wants two things from this file: a list cheap enough to draw beside the chat, and
// one conversation in full.

import { all, one, run, tx } from '@/store/query'
import type { Turn } from '@/server/assistant-dialects'
import type { Usage } from '@/server/assistant-dialects'

/** A row in the left column: enough to choose by, and no turns at all. */
export type ChatSummary = {
  id: number
  title: string
  updatedAt: string
  /** What the whole conversation has cost so far. */
  usage: Usage
  /** The last round's input, which is what the next question pays again. */
  context: number
}

export type Chat = ChatSummary & { turns: Turn[] }

type Row = {
  id: number
  title: string
  turns: string
  input_tokens: number
  output_tokens: number
  context_tokens: number
  updated_at: number
}

const summary = (r: Row): ChatSummary => ({
  id: r.id,
  title: r.title,
  updatedAt: new Date(r.updated_at).toISOString(),
  usage: { input: r.input_tokens, output: r.output_tokens },
  context: r.context_tokens,
})

/**
 * The turns, or an empty conversation.
 *
 * A row whose JSON will not parse is a row written by a version that is not this one, or by
 * a disk that lied. Answering with an empty conversation loses that chat and keeps the
 * screen; throwing would take the whole list down with it.
 */
function readTurns(json: string): Turn[] {
  try {
    const parsed: unknown = JSON.parse(json)
    return Array.isArray(parsed) ? (parsed as Turn[]) : []
  } catch {
    console.error('[ERROR] assistant-chats: a stored conversation would not parse')
    return []
  }
}

const COLS = `id, title, turns, input_tokens, output_tokens, context_tokens, updated_at`

/** Newest first, because the one you want is almost always the one you just had. */
export function listChats(limit = 60): ChatSummary[] {
  return all<Row>(
    `select ${COLS} from assistant_chats order by updated_at desc limit ?`, limit,
  ).map(summary)
}

export function getChat(id: number): Chat | null {
  const row = one<Row>(`select ${COLS} from assistant_chats where id = ?`, id)
  return row ? { ...summary(row), turns: readTurns(row.turns) } : null
}

/**
 * The title is the first question, trimmed to something that fits a column.
 *
 * Not asked of the model: naming a chat would be a second request, on the owner's bill,
 * for a label they are about to read the first line of anyway.
 */
export function titleFrom(turns: Turn[]): string {
  const first = turns.find((t) => t.kind === 'user')
  const text = first && first.kind === 'user' ? first.text : ''
  const line = text.replace(/\s+/g, ' ').trim()
  return line.length > 70 ? `${line.slice(0, 69)}…` : line
}

export function createChat(): number {
  const now = Date.now()
  // Two statements in one transaction, because `run()` reports only `changes` and widening
  // that shared primitive for one caller is a worse trade than asking SQLite the question
  // it already knows the answer to. The transaction is what makes the second statement's
  // answer certainly about the first.
  return tx(() => {
    run(`insert into assistant_chats (title, turns, created_at, updated_at) values ('', '[]', ?, ?)`, now, now)
    return one<{ id: number }>(`select last_insert_rowid() as id`)?.id ?? 0
  })
}

/**
 * Store the whole conversation as it now stands.
 *
 * `usage` ADDS, because a conversation's cost is everything it has ever spent; `context`
 * REPLACES, because it is a measurement of the conversation's present size rather than a
 * running total. Getting those two the same way round was the whole point of separating
 * them.
 */
export function saveChat(id: number, turns: Turn[], usage: Usage, context: number): void {
  run(
    `update assistant_chats
        set turns = ?, title = case when title = '' then ? else title end,
            input_tokens = input_tokens + ?, output_tokens = output_tokens + ?,
            context_tokens = ?, updated_at = ?
      where id = ?`,
    JSON.stringify(turns), titleFrom(turns), usage.input, usage.output, context, Date.now(), id,
  )
}

export function renameChat(id: number, title: string): void {
  run(`update assistant_chats set title = ?, updated_at = ? where id = ?`, title.slice(0, 200), Date.now(), id)
}

/** Gone, not trashed: ADR 0040 says why a Trash full of chat receipts helps nobody. */
export function deleteChat(id: number): boolean {
  return run(`delete from assistant_chats where id = ?`, id).changes > 0
}
