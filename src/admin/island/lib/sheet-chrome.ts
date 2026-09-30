// THE EDITOR'S FURNITURE, MOUNTED AND TAKEN DOWN.
//
// Three pieces of chrome that are not in the sheet's markup, because none of them belongs to
// it: the button strip is the editor's own row of commands, the bubble bar is positioned by a
// ProseMirror plugin, and the "/" menu is `position: fixed` at coordinates the editor measured
// when the key was pressed. ADR 0054's third decision is the line this file sits on — the page
// arrives as HTML, and the APPLICATION inside it builds its own furniture.
//
// The button strip is mounted and unmounted rather than hidden, and that is not a lapse from
// the one-DOM rule: it is STICKY and takes space at the top of the sheet, so the Markdown view
// and focus mode both want it gone rather than invisible.
import type { Editor } from '@/admin/editor/editor'
import type { SheetWords } from '@/admin-shared/sheet-wire'
import { mountToolbar, toolbarWords, type Toolbar } from '@/admin/components/editor-toolbar'
import { mountBubbleBar, openSlashMenu, type BubbleBar, type SlashAt, type SlashMenu } from '@/admin/components/editor-menus'

// The sticky band above the writing: the action line plus the toolbar strip that sticks under
// it (~60px with its margins). The bubble bar must not be placed inside this band, because both
// are sticky and would cover it — the first line of a piece is where that happens.
const ACTIONBAR_HEIGHT = 116

/** Above this the action line is sticky and the toolbar has to clear it; below, it is not. */
const DESKTOP = '(min-width: 1024px)'

export type ChromeParts = {
  /** The action line, MEASURED rather than guessed: it wraps to two rows in the locales with
   *  the longest labels, and the toolbar's offset is different on every wrap. */
  bar: HTMLElement
  toolbarSlot: HTMLElement
  findSlot: HTMLElement
}

export type ChromeHooks = {
  editor: Editor
  t: SheetWords
  askLink: (previous: string) => Promise<string | null>
  onPickImage: () => void
  onPickGallery: () => void
  /** The Markdown source view is showing, so none of this belongs on screen. */
  raw: () => boolean
  /** Focus mode takes the button strip away; "/" and the bubble still carry every command. */
  focus: () => boolean
  /** The find strip is open, and the selection is ITS rather than the writer's. */
  finding: () => boolean
  /**
   * The "/" menu has gone — chosen from, clicked away from, or scrolled away from.
   *
   * The caller holds a note of WHERE it was open, because the writing surface's own key handler
   * reads that note to decide whether Escape belongs to the menu. Left set after the menu shut
   * itself, Escape goes on being eaten by a menu that is not there.
   */
  onSlashShut: () => void
}

export type Chrome = {
  /** Re-decide what is on screen. Cheap: a mount only happens when the answer changed. */
  sync: () => void
  /** How tall the find strip is right now, so the toolbar sticks below rather than behind. */
  setFindHeight: (px: number) => void
  /** Open the "/" menu where the "/" was typed, or shut the one that is open. */
  openSlash: (at: SlashAt | null) => void
  /** Offer the open "/" menu a key; true when it used it. */
  slashKey: (key: string) => boolean
  destroy: () => void
}

export function mountChrome(parts: ChromeParts, hooks: ChromeHooks): Chrome {
  const { editor, t } = hooks
  let toolbar: Toolbar | null = null
  let bubble: BubbleBar | null = null
  let slash: SlashMenu | null = null
  let findHeight = 0
  let barHeight = 0

  const wide = matchMedia(DESKTOP)

  /** Where the toolbar has to start sticking: flush under the action line, plus any strip. */
  const stickAt = (): number => (wide.matches ? barHeight : 0) + findHeight

  const place = (): void => {
    const top = stickAt()
    toolbar?.setTop(top)
    // The find strip sits in the same sticky stack, directly under the action line.
    parts.findSlot.style.top = `${wide.matches ? barHeight : 0}px`
    bubble?.setAvoidTop(top + ACTIONBAR_HEIGHT)
  }

  const sync = (): void => {
    const wantBar = !hooks.raw() && !hooks.focus()
    // No bar wanted and none drawn yet: the row the server held for it goes too.
    if (!wantBar && !toolbar) parts.toolbarSlot.replaceChildren()
    if (wantBar && !toolbar) {
      toolbar = mountToolbar(parts.toolbarSlot, {
        editor,
        askLink: hooks.askLink,
        onPickImage: hooks.onPickImage,
        onPickGallery: hooks.onPickGallery,
        words: toolbarWords(t),
      })
    } else if (!wantBar && toolbar) {
      toolbar.destroy()
      toolbar = null
    }

    // ⚠️ NO BUBBLE WHILE THE FIND STRIP IS OPEN. The strip SELECTS each hit as it steps onto
    // it, so without this the formatting bubble rose over every match and covered the line
    // above the very word the writer had gone looking for. While the strip is open the
    // selection is the find's rather than the writer's, and the bubble has nothing to offer
    // about it.
    const wantBubble = !hooks.raw() && !hooks.finding()
    if (wantBubble && !bubble) bubble = mountBubbleBar(editor, t, hooks.askLink)
    else if (!wantBubble && bubble) { bubble.destroy(); bubble = null }

    place()
  }

  // The bar's height is a measurement and it changes: a translation wraps it, a resize unwraps
  // it, and the recovered-work strip adds a row to it the moment a draft is found.
  const watch = new ResizeObserver(() => {
    barHeight = Math.ceil(parts.bar.getBoundingClientRect().height)
    place()
  })
  watch.observe(parts.bar)
  barHeight = Math.ceil(parts.bar.getBoundingClientRect().height)
  const onWide = (): void => place()
  wide.addEventListener('change', onWide)

  sync()

  return {
    sync,
    setFindHeight: (px: number) => { findHeight = px; place() },
    openSlash: (at) => {
      // ⚠️ `onClose` IS A REQUEST, NOT THE DOING. The menu asks to be taken down — a click
      // outside it, a scroll, a row chosen — and the function it RETURNED is what removes it.
      // Answering the request by forgetting the handle leaves the menu on the page over an
      // editor that has already run the command.
      const drop = (): void => {
        if (!slash) return
        slash.close()
        slash = null
        hooks.onSlashShut()
      }
      drop()
      if (!at || hooks.raw()) return
      slash = openSlashMenu({
        editor,
        t,
        at,
        onClose: drop,
        onPickImage: () => { drop(); hooks.onPickImage() },
        onPickGallery: () => { drop(); hooks.onPickGallery() },
      })
    },
    slashKey: (key) => slash?.key(key) ?? false,
    destroy: () => {
      watch.disconnect()
      wide.removeEventListener('change', onWide)
      slash?.close()
      toolbar?.destroy()
      bubble?.destroy()
    },
  }
}
