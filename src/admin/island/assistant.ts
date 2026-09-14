// The assistant screen's behaviour (ADR 0054): the composer, the stream, the pause, and the two
// columns beside them.
//
// EVERY STATE THIS SCREEN CAN BE IN WAS ALREADY DRAWN by the server — the empty page, the
// transcript of the conversation in the address, the chat list, the log column, and inside each
// exchange a waiting line, a streaming line, a pause and a cost row, all hidden. This file
// unhides them and appends what arrives after the page loaded. The one thing it BUILDS is an
// exchange for a question asked in this tab, and it builds it from `@/admin-shared/assistant-
// marks` — the same description the server drew the ones above it from, so a reload cannot
// change the page under the reader.
//
// ⚠️ The request that costs money lives in `lib/assistant-stream.ts` and nowhere else.
import { CONTEXT_WARN, blocksOf, entriesOf, tokens, type Pending, type Turn } from '@/admin-shared/assistant'
import { richMarks } from '@/admin-shared/rich-text'
import {
  blockMarks, chatRowMark, logEntryMark,
  type AssistantWords, type ChatRow,
} from '@/admin-shared/assistant-marks'
import { fill } from './lib/mark-dom'
import { ask, type Usage } from './lib/assistant-stream'
import { scrollBehavior } from '@/admin/motion'

const root = document.querySelector<HTMLElement>('[data-screen="assistant"]')

const LOG_KEY = 'quireink-admin-assistant-log'

if (root) {
  const screen: HTMLElement = root
  const words = JSON.parse(screen.dataset.aiWords ?? '{}') as AssistantWords
  const configured = screen.dataset.aiConfigured === '1'
  const pick = <T extends Element>(sel: string): T | null => screen.querySelector<T>(sel)

  const list = pick<HTMLOListElement>('[data-ai-blocks]')
  const empty = pick<HTMLElement>('[data-ai-empty]')
  const errorLine = pick<HTMLElement>('[data-ai-error]')
  const endMark = pick<HTMLElement>('[data-ai-end]')
  const box = pick<HTMLTextAreaElement>('[data-ai-box]')
  const sendBtn = pick<HTMLButtonElement>('[data-ai-send]')
  const contextTag = pick<HTMLElement>('[data-ai-context]')
  const contextN = pick<HTMLElement>('[data-ai-context-n]')
  const logList = pick<HTMLOListElement>('[data-ai-log-list]')
  const logEmpty = pick<HTMLElement>('[data-ai-log-empty]')
  const chatList = pick<HTMLUListElement>('[data-ai-chats]')
  const noChats = pick<HTMLElement>('[data-ai-no-chats]')

  let chatId: number | null = Number(screen.dataset.aiOpen) || null
  let turns: Turn[] = []
  let busy = false
  let awaiting: Pending[] = []
  const cost = new Map<number, Usage>()

  // The turns behind the transcript the server drew. Read rather than shipped twice: the
  // markup is already on the page, and a second copy as JSON would double a long conversation
  // for a number nobody looks at. Nothing can be asked until it lands, which is why `send`
  // awaits it rather than checking a flag.
  const ready: Promise<void> = chatId
    ? fetch(`/api/assistant/chats/${chatId}`)
      .then((r) => r.json())
      .then((j: { success?: boolean; data?: { turns: Turn[] } }) => {
        if (j.success && j.data) turns = j.data.turns
      })
      .catch(() => { /* the transcript stands; the next question starts a fresh window */ })
    : Promise.resolve()

  const say = (message: string): void => {
    if (!errorLine) return
    errorLine.textContent = message
    errorLine.hidden = message === ''
  }

  const toEnd = (): void => {
    endMark?.scrollIntoView({ block: 'end', behavior: scrollBehavior() })
  }

  // ---- the composer --------------------------------------------------------------------

  /** One row at rest — the height of the button beside it — growing to six as it fills. */
  function grow(): void {
    if (!box) return
    box.style.height = 'auto'
    box.style.height = `${Math.min(box.scrollHeight, 160)}px`
  }

  function armSend(): void {
    if (sendBtn) sendBtn.disabled = busy || !configured || (box?.value.trim() ?? '') === ''
    if (box) box.disabled = busy || !configured
    if (sendBtn) sendBtn.textContent = busy ? words.busy : words.send
  }

  box?.addEventListener('input', () => { grow(); armSend() })
  box?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(box.value) }
  })
  sendBtn?.addEventListener('click', () => { if (box) void send(box.value) })
  // Takes the text rather than reading the box, so an example chip can send without first
  // writing into a field the owner never typed in.
  screen.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-ai-eg]')
    if (chip) void send(chip.textContent ?? '')
  })

  // ---- the transcript ------------------------------------------------------------------

  /** The exchange in flight: the one the waiting line, the stream and the pause belong to. */
  const lastBlock = (): HTMLElement | null =>
    list?.lastElementChild as HTMLElement | null

  function show(el: HTMLElement | null, on: boolean): void {
    if (el) el.hidden = !on
  }

  /** Everything the server would have drawn for these turns, drawn again from the same marks. */
  function redraw(live = '', waiting = false): void {
    if (!list) return
    const blocks = blocksOf(turns)
    fill(list, blockMarks(turns, words, { live, waiting, awaiting, cost: cost.get(blocks.length - 1) }))
    show(list, blocks.length > 0)
    show(empty, blocks.length === 0)
    redrawLog()
  }

  function redrawLog(): void {
    if (!logList) return
    const entries = entriesOf(turns)
    fill(logList, entries.map((e) => logEntryMark(e, words)))
    show(logEmpty, entries.length === 0)
  }

  const WARM = 'text-amber-700 dark:text-amber-500'
  const COOL = 'text-neutral-500 dark:text-neutral-400'

  /** ONE ink class, never two: see `screens/assistant.ts` for what two of them cost. */
  function setContext(n: number): void {
    if (contextN) contextN.textContent = tokens(n)
    if (contextTag) contextTag.className = `text-xs tabular-nums ${n > CONTEXT_WARN ? WARM : COOL}`
    show(contextTag, n > 0)
  }

  // ---- asking --------------------------------------------------------------------------

  /** A row to write into, because the first question of a conversation needs one to belong to. */
  async function startChat(): Promise<number | null> {
    const res = await fetch('/api/assistant/chats', { method: 'POST' })
    const json = await res.json() as { success?: boolean; data?: { id: number } }
    const id = json.success && json.data ? json.data.id : null
    if (id) {
      chatId = id
      // The address follows the conversation, so a reload reopens what is on screen. Replace
      // rather than push: the chat was not navigated to, it was started here.
      const url = new URL(location.href)
      url.searchParams.set('chat', String(id))
      history.replaceState(history.state, '', url)
    }
    return id
  }

  async function send(text: string): Promise<void> {
    const asked = text.trim()
    if (!asked || busy || !configured) return
    await ready
    say('')
    if (box) { box.value = ''; box.style.height = 'auto' }
    turns = [...turns, { kind: 'user', text: asked }]
    awaiting = []
    if (chatId === null) await startChat()
    await exchange({})
  }

  /**
   * Continue a paused conversation.
   *
   * The turns are already what they were: the answer is two lists of ids, so nothing the screen
   * sends can name an action the model did not ask for.
   */
  async function answer(verdict: { approve?: string[]; decline?: string[] }): Promise<void> {
    if (busy) return
    awaiting = []
    await exchange(verdict)
  }

  async function exchange(verdict: { approve?: string[]; decline?: string[] }): Promise<void> {
    busy = true
    armSend()
    // Which exchange this answer belongs to, counted before the request so the cost lands on
    // the right block when two questions are asked in quick succession.
    const blockIndex = Math.max(0, blocksOf(turns).length - 1)
    redraw('', true)
    toEnd()
    try {
      const landed = await ask(turns, chatId, verdict, (shown) => {
        const live = lastBlock()?.querySelector<HTMLElement>('[data-ai-live]')
        const textNode = lastBlock()?.querySelector<HTMLElement>('[data-ai-live-text]')
        if (!live || !textNode) return
        show(lastBlock()?.querySelector<HTMLElement>('[data-ai-wait]') ?? null, false)
        show(live, true)
        fill(textNode, richMarks(shown))
      })
      if (landed) {
        turns = [...turns, ...landed.turns]
        awaiting = landed.awaiting
        if (landed.usage) cost.set(blockIndex, landed.usage)
        if (landed.context !== undefined) setContext(landed.context)
        void refreshChats()
      }
    } catch (e) {
      const msg = (e as Error).message
      say(msg === 'ai_not_configured' ? words.notConfigured : words.failed)
    } finally {
      busy = false
      armSend()
      redraw()
      setTimeout(toEnd, 30)
    }
  }

  screen.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (target.closest('[data-ai-allow]')) void answer({ approve: awaiting.map((a) => a.id) })
    else if (target.closest('[data-ai-deny]')) void answer({ decline: awaiting.map((a) => a.id) })
  })

  // ---- the two columns -----------------------------------------------------------------

  async function refreshChats(): Promise<void> {
    if (!chatList) return
    const res = await fetch('/api/assistant/chats').catch(() => null)
    const json = await res?.json().catch(() => null) as { success?: boolean; data?: ChatRow[] } | null
    if (!json?.success || !json.data) return
    fill(chatList, json.data.map((c) => chatRowMark(c, chatId, words)))
    show(noChats, json.data.length === 0)
  }

  chatList?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const row = target.closest<HTMLElement>('[data-ai-chat]')
    if (!row) return
    if (target.closest('[data-ai-del]')) { row.dataset.aiConfirming = ''; return }
    if (target.closest('[data-ai-del-no]')) { delete row.dataset.aiConfirming; return }
    if (target.closest('[data-ai-del-yes]')) void removeChat(row)
  })

  async function removeChat(row: HTMLElement): Promise<void> {
    const id = Number(row.dataset.aiChat)
    if (!id) return
    await fetch(`/api/assistant/chats/${id}`, { method: 'DELETE' }).catch(() => null)
    // The conversation on screen is the one that just went: the page has to stop claiming to
    // be a chat that no longer exists, so it goes back to the bare address.
    if (id === chatId) { location.href = '/admin/assistant'; return }
    row.remove()
    show(noChats, (chatList?.childElementCount ?? 0) === 0)
  }

  // ---- the log column ------------------------------------------------------------------

  const logPane = pick<HTMLElement>('[data-ai-log]')
  const logToggle = pick<HTMLButtonElement>('[data-ai-log-toggle]')

  /**
   * Open or shut, and it stays how it was left.
   *
   * DEFAULT OPEN: the column exists because an owner letting a model touch a live blog should
   * be able to see what it touched, and a record you have to go and find is a record most
   * people never look at. Shutting it is then a decision, and decisions persist.
   */
  function setLog(open: boolean): void {
    if (logPane) logPane.hidden = !open
    logToggle?.setAttribute('aria-pressed', String(open))
    try { localStorage.setItem(LOG_KEY, open ? '1' : '0') } catch { /* nothing to remember with */ }
  }

  let logOpen = true
  try { logOpen = localStorage.getItem(LOG_KEY) !== '0' } catch { /* the default stands */ }
  if (!logOpen) { if (logPane) logPane.hidden = true; logToggle?.setAttribute('aria-pressed', 'false') }
  logToggle?.addEventListener('click', () => setLog(logPane?.hidden === true))

  /** Long results are folded, because one archive listing would otherwise be the whole column. */
  logList?.addEventListener('click', (e) => {
    const fold = (e.target as HTMLElement).closest<HTMLElement>('[data-ai-fold]')
    if (!fold) return
    const entry = fold.closest('li')
    const tail = entry?.querySelector<HTMLElement>('[data-ai-tail]')
    const ell = entry?.querySelector<HTMLElement>('[data-ai-ell]')
    if (!tail) return
    const opening = tail.hidden
    tail.hidden = !opening
    if (ell) ell.hidden = opening
    fold.textContent = opening ? words.close : words.showAll
  })

  armSend()
}
