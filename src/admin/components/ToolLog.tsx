// WHAT IT ACTUALLY DID, unedited.
//
// The transcript shows the answer and a chip per tool. That is the right amount for
// reading, and the wrong amount for trusting: an owner who has just let a model change
// settings on their live blog is entitled to see the call, the arguments and the result
// exactly as they went across, not a summary the same model wrote of its own work.
//
// So this column is deliberately RAW. Monospace, real times, whole arguments, the tool's
// own answer with its JSON unprettified. Everything else in this admin is edited for
// reading; this is the one surface where editing would be the bug.
import { useEffect, useState, type JSX } from 'react'
import { META } from './kit'
import { useAdminT } from './I18nProvider'

type Turn =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool_use'; id: string; name: string; args: Record<string, unknown>; reasoning?: string; at?: number }
  | { kind: 'tool_result'; id: string; name: string; text: string }

const OPEN_KEY = 'quireink-admin-assistant-log'

/**
 * Open or shut, and it stays how it was left.
 *
 * DEFAULT OPEN: the column exists because an owner letting a model touch a live blog
 * should be able to see what it touched, and a record you have to go and find is a record
 * most people never look at. Shutting it is then a decision, and decisions persist —
 * the same rule the rail's "Everything else" group follows.
 *
 * Read in an effect rather than in the initial state: the admin is one bundle served to
 * every screen, and reading storage during the first render is how a component ends up
 * with a different answer on the server than in the browser.
 */
export function useToolLog(): { open: boolean; toggle: () => void } {
  const [open, setOpen] = useState(true)
  useEffect(() => {
    try {
      if (localStorage.getItem(OPEN_KEY) === '0') setOpen(false)
    } catch { /* a browser with storage refused: the default stands */ }
  }, [])
  const toggle = () => setOpen((v) => {
    const next = !v
    try { localStorage.setItem(OPEN_KEY, next ? '1' : '0') } catch { /* nothing to remember with */ }
    return next
  })
  return { open, toggle }
}

/** One call and the answer that came back to it. */
type Entry = { id: string; name: string; args: Record<string, unknown>; at?: number; result?: string }

/**
 * Calls paired with their results, oldest first.
 *
 * By `id` rather than by position: parallel calls are dispatched together and their
 * results arrive in whatever order the tools finished, so walking the list in pairs would
 * hand a settings answer to a media call about half the time.
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
  return order.map((id) => byId.get(id)!).filter(Boolean)
}

/**
 * JSON, made readable WITHOUT colour.
 *
 * A syntax palette is the obvious answer and the wrong one here: this admin is monochrome
 * plus the product's own pen box, and each of those inks already means something
 * (`docs/admin-design.md` — highlighter is where-you-are, red is what-destroys). Spending
 * four new hues on a debug column would make the one screen that must be believed the one
 * screen that dresses differently from every other.
 *
 * So the same job is done with INK LEVEL and WEIGHT, which is what a reader is actually
 * using when they scan JSON: keys darkest, values mid, punctuation faintest.
 */
function Json({ text }: { text: string }): JSX.Element {
  // Three groups: a key (a quoted string followed by a colon), any other quoted string,
  // and everything else. Deliberately not a parser — a truncated result is not valid JSON
  // and must still be shown.
  const parts = text.split(/("(?:[^"\\]|\\.)*"\s*:|"(?:[^"\\]|\\.)*")/g)
  return (
    <>
      {parts.map((piece, i) => {
        if (piece === '') return null
        if (/^"(?:[^"\\]|\\.)*"\s*:$/.test(piece)) {
          return <span key={i} className="font-medium text-neutral-800 dark:text-neutral-200">{piece}</span>
        }
        if (piece.startsWith('"')) {
          return <span key={i} className="text-neutral-600 dark:text-neutral-400">{piece}</span>
        }
        return <span key={i} className="text-neutral-400 dark:text-neutral-500">{piece}</span>
      })}
    </>
  )
}

const clock = (at?: number): string =>
  at === undefined ? '' : new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** Long results are folded, because one archive listing would otherwise be the whole column. */
const FOLD = 400

function Result({ text }: { text: string }): JSX.Element {
  const t = useAdminT()
  const [open, setOpen] = useState(false)
  const long = text.length > FOLD
  return (
    <>
      <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
        <Json text={open || !long ? text : `${text.slice(0, FOLD)}…`} />
      </pre>
      {long && (
        <button type="button" className={`${META} underline`} onClick={() => setOpen((v) => !v)}>
          {open ? t.close : t.assistantShowAll}
        </button>
      )}
    </>
  )
}

export function ToolLog({ turns, open }: { turns: Turn[]; open: boolean }): JSX.Element | null {
  const t = useAdminT()
  const entries = entriesOf(turns)
  if (!open) return null

  return (
    <aside className="hidden w-80 shrink-0 flex-col self-stretch overflow-hidden border-l border-neutral-200 min-[1600px]:flex dark:border-neutral-800">
      <div className="border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
        <span className={META}>{t.assistantDidThis}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {entries.length === 0 ? (
          <p className={META}>{t.assistantDidNothing}</p>
        ) : (
          <ol className="space-y-4">
            {entries.map((e) => (
              <li key={e.id}>
                <p className="flex items-baseline gap-2">
                  <span className={`${META} tabular-nums`}>{clock(e.at)}</span>
                  <span className="font-mono text-xs text-neutral-900 dark:text-neutral-100">{e.name}</span>
                </p>
                {/* The arguments as sent. An empty object is shown rather than hidden: "it
                    called this with nothing" is a fact, and a missing line reads as a
                    missing record. */}
                <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
                  <Json text={JSON.stringify(e.args)} />
                </pre>
                {e.result !== undefined && <Result text={e.result} />}
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  )
}
