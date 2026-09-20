// THE TIME MACHINE, opened.
//
// The dialog's frame is in the markup (`screens/sheet-history.ts`); this fetches the versions
// and builds the rows, which is the only part of it that could not honestly be drawn — they
// come off `/api/posts/:slug/revisions` and change with every save.
//
// Restoring is NOT destructive: the version on screen is itself snapshotted on the next save,
// so the way back is the same door.
import type { PostRevision } from '@/types'
import type { SheetWords } from '@/admin-shared/sheet-wire'
import { formatDateTimeShort } from '@/admin-shared/when'
import { buttonClass, INSET } from '@/admin-shared/kit'
import { el } from '@/admin/components/node-dom'

const className = {
  row: INSET,
  head: 'flex items-center justify-between gap-3',
  who: 'min-w-0',
  title: 'font-medium',
  when: 'text-xs text-neutral-500 dark:text-neutral-400',
  // Two lines of the body, so a list of versions is distinguishable without opening any of
  // them. `line-clamp-2` needs no `block` beside it: the utility sets its own display.
  taste: 'mt-2 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-300',
}

/** The first ~180 characters of the body, stripped of Markdown noise. */
function taste(content: string): string {
  const text = content.replace(/[#>*`_~\-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > 180 ? `${text.slice(0, 180)}…` : text
}

export type History = {
  open: () => void
  destroy: () => void
}

export function wireHistory(
  root: HTMLElement,
  hooks: { t: SheetWords; slug: () => string; onRestore: (rev: PostRevision) => void },
): History {
  const box = root.querySelector<HTMLElement>('[data-history]')
  const list = root.querySelector<HTMLElement>('[data-history-list]')
  const wait = root.querySelector<HTMLElement>('[data-history-wait]')
  const none = root.querySelector<HTMLElement>('[data-history-none]')
  if (!box || !list || !wait || !none) return { open: () => {}, destroy: () => {} }

  const { t } = hooks
  let opener: HTMLElement | null = null

  const shut = (): void => {
    box.hidden = true
    opener?.focus()
  }

  const draw = (revisions: PostRevision[]): void => {
    wait.hidden = true
    none.hidden = revisions.length > 0
    list.hidden = revisions.length === 0
    list.replaceChildren()
    revisions.forEach((rev, i) => {
      const row = el('li', { className: className.row })
      const head = el('div', { className: className.head })
      const who = el('div', { className: className.who })
      const name = el('div', { className: className.title })
      name.textContent = rev.title || t.untitled
      const when = el('div', { className: className.when })
      when.textContent = (i === 0 ? `${t.tmLatest} · ` : '') + formatDateTimeShort(rev.savedAt)
      who.append(name, when)
      const key = el('button', { className: buttonClass('secondary'), type: 'button' })
      key.textContent = t.restore
      key.addEventListener('click', () => { shut(); hooks.onRestore(rev) })
      head.append(who, key)
      row.appendChild(head)
      const first = taste(rev.content)
      if (first) {
        const line = el('p', { className: className.taste })
        line.textContent = first
        row.appendChild(line)
      }
      list.appendChild(row)
    })
  }

  const load = async (): Promise<void> => {
    const slug = hooks.slug()
    if (!slug) { draw([]); return }
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(slug)}/revisions`)
      const json = await res.json() as { success?: boolean; data?: PostRevision[] }
      draw(json.success && json.data ? json.data : [])
    } catch {
      // Offline, or the route refused. An empty list says the true thing — nothing was read —
      // and the dialog can be shut and opened again.
      draw([])
    }
  }

  // A click on the backdrop is "not now"; a click inside the box is not.
  box.addEventListener('click', (e) => { if (e.target === box) shut() })
  root.querySelector<HTMLElement>('[data-history-shut]')?.addEventListener('click', shut)
  const escape = (e: KeyboardEvent): void => { if (e.key === 'Escape' && !box.hidden) shut() }
  window.addEventListener('keydown', escape)

  return {
    open: () => {
      opener = document.activeElement as HTMLElement | null
      // Back to the three states it opens in, every time: a dialog reopened after a restore
      // must not show the list it had before the save that changed it.
      wait.hidden = false
      none.hidden = true
      list.hidden = true
      list.replaceChildren()
      box.hidden = false
      // ⚠️ AND FOCUS GOES IN WITH IT. `shut()` already hands focus back to the opener; nothing
      // took it in the first place, so `aria-modal="true"` was a promise the very next Tab
      // broke — the keyboard walked into the editor behind the scrim. The box carries
      // `tabindex="-1"` so it can hold it.
      box.querySelector<HTMLElement>('[data-history-box]')?.focus()
      void load()
    },
    destroy: () => window.removeEventListener('keydown', escape),
  }
}
