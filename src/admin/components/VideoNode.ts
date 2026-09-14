// Editor node for an embedded video. Stored in Markdown as a bare URL on its own line (so the
// content stays 100% Markdown); shown here as a responsive embed. The public renderer turns the
// same URL into an iframe.
//
// ⚠️ A PLAIN PROSEMIRROR NODE VIEW, not a React one (ADR 0054 step 5, first half). What that
// buys is not tidiness: a node view is the one piece of the editor that runs INSIDE the
// document, so while it is a React component every document this admin can open is a document
// React has to be mounted to draw. Nothing here needed React — there was no state, no effect
// and no ref, only JSX.
//
// ⚠️ ITS WORDS ARRIVE THROUGH `configure()`, because a node view has no context to read them
// from. `useAdminT()` was a React hook; the alternative to passing them in would be an island
// importing all eleven dictionaries to print two labels.
import { Node, type NodeViewRenderer } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { videoEmbed, videoFileUrl } from '@/render/video'
import { SEGMENT_TRACK, tabItemClass } from '@/admin-shared/tabs'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    video: { setVideo: (src: string) => ReturnType }
  }
}

export type VideoWords = { column: string; wide: string }

/**
 * ⚠️ `className:` BY NAME, not a bare second argument, and `check:admin-css` is why. That guard
 * reads every class this admin writes and proves the stylesheet has a rule for it — and it can
 * only see a class it can NAME. Passed positionally, the whole of this file's chrome became
 * invisible to it: the count fell by one and the check stayed green, which is what a guard that
 * has quietly stopped checking looks like.
 */
const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K, opts: { className?: string } & Record<string, string> = {},
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  const { className, ...attrs } = opts
  if (className) node.className = className
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  return node
}

/**
 * ONE ELEMENT, REDRAWN. A node view may rebuild its own insides on `update()` — what it must
 * not do is replace `dom`, which ProseMirror holds a reference to.
 */
class VideoView {
  readonly dom: HTMLElement
  private readonly bar: HTMLElement
  private readonly body: HTMLElement
  private node: PMNode
  private selected = false

  constructor(
    node: PMNode,
    private readonly words: VideoWords,
    private readonly select: () => void,
  ) {
    this.node = node
    this.dom = el('div', { className: 'my-4' })
    this.dom.setAttribute('data-drag-handle', '')
    this.bar = el('div', { className: 'mb-2 flex flex-wrap gap-2' })
    this.bar.contentEditable = 'false'
    // The bar belongs to the chrome, not to the document: a mousedown that reached ProseMirror
    // would move the selection out of the node whose toolbar is being pressed.
    this.bar.addEventListener('mousedown', (e) => e.preventDefault())
    this.body = el('div')
    this.dom.append(this.bar, this.body)
    this.paint()
  }

  /** The `#wide` fragment, kept out of URL detection and re-attached by the toggle. */
  private parts(): { src: string; wide: boolean } {
    const raw = (this.node.attrs.src as string) || ''
    const [src = '', frag = ''] = raw.split('#')
    return { src, wide: /wide/.test(frag) }
  }

  private paint(): void {
    const { src, wide } = this.parts()
    const embed = videoEmbed(src)
    const file = embed ? null : videoFileUrl(src)

    // `tabItemClass`, not a sixth hand-drawn pill. Four of these existed inside the editor
    // alone and none was caught, because `check:admin-kit` matched the tab track's exact string
    // and every copy had chosen `bg-neutral-100` over `bg-neutral-200/70`.
    this.bar.replaceChildren()
    this.bar.hidden = !(this.selected && (embed || file))
    if (!this.bar.hidden) {
      const track = el('div', { className: SEGMENT_TRACK })
      for (const [on, label] of [[false, this.words.column], [true, this.words.wide]] as const) {
        const key = el('button', {
          className: tabItemClass(wide === on, 'sm'),
          type: 'button',
          // The server's own `tabs()` says this and the React node view never did: a segmented
          // control whose pressed state is only a background colour is a control a screen
          // reader cannot report.
          'aria-pressed': String(wide === on),
        })
        key.textContent = label
        key.addEventListener('click', () => this.setWide(on))
        track.appendChild(key)
      }
      this.bar.appendChild(track)
    }

    this.body.replaceChildren()
    if (embed) {
      const frame = el('div', { className: 'relative w-full overflow-hidden rounded-lg' })
      frame.style.aspectRatio = '16 / 9'
      const iframe = el('iframe', {
        className: 'absolute inset-0 h-full w-full',
        src: embed.embed, allowfullscreen: '', loading: 'lazy',
      })
      frame.append(iframe, this.overlay())
      this.body.appendChild(frame)
    } else if (file) {
      // A self-hosted file (a Library upload): the native player at its natural aspect, which
      // mirrors the published `.video-file` rendering.
      const frame = el('div', { className: 'relative' })
      const video = el('video', {
        className: 'block w-full rounded-lg',
        src: file, controls: '', preload: 'metadata', playsinline: '',
      })
      frame.append(video, this.overlay())
      this.body.appendChild(frame)
    } else {
      const line = el('p', { className: 'break-all text-sm text-neutral-500 dark:text-neutral-400' })
      line.textContent = src
      this.body.appendChild(line)
    }
  }

  /**
   * The iframe and the native player both swallow clicks, so clicking the video never selected
   * the node — and the size bar, which only appears when it IS selected, could never be
   * reached. A transparent sheet over the player catches the click instead. Playback is not
   * what somebody is here for.
   */
  private overlay(): HTMLElement {
    const sheet = el('div', { className: 'absolute inset-0 cursor-pointer' })
    sheet.addEventListener('mousedown', (e) => { e.preventDefault(); this.select() })
    return sheet
  }

  private setWide(w: boolean): void {
    const { src } = this.parts()
    this.attrs({ src: w ? `${src}#wide` : src })
  }

  /** Set by the extension, which is the only place that can reach `getPos`. */
  attrs: (next: Record<string, unknown>) => void = () => {}

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false
    this.node = node
    this.paint()
    return true
  }

  selectNode(): void { this.selected = true; this.paint() }
  deselectNode(): void { this.selected = false; this.paint() }

  /**
   * ⚠️ EVERY EVENT INSIDE THIS VIEW IS THE VIEW'S. Without this, a click on the size key is an
   * event ProseMirror tries to interpret as a position in the document — which is how a toolbar
   * inside a node ends up moving the caret instead of pressing a button.
   */
  stopEvent(): boolean { return true }

  /** The bar and the player are drawn by this class; ProseMirror must not read them back. */
  ignoreMutation(): boolean { return true }
}

export const Video = Node.create<{ words: VideoWords }>({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return { words: { column: 'Column', wide: 'Large' } }
  },

  addAttributes() {
    return { src: { default: '' } }
  },
  parseHTML() {
    return [{ tag: 'div[data-video]', getAttrs: (node) => ({ src: (node as HTMLElement).getAttribute('data-src') || '' }) }]
  },
  renderHTML({ node }) {
    return ['div', { 'data-video': '', 'data-src': node.attrs.src }]
  },
  addNodeView(): NodeViewRenderer {
    const words = this.options.words
    return ({ node, editor, getPos }) => {
      const view = new VideoView(node, words, () => {
        const pos = getPos?.()
        if (pos != null) editor.commands.setNodeSelection(pos)
      })
      view.attrs = (next) => {
        const pos = getPos?.()
        if (pos == null) return
        editor.view.dispatch(editor.view.state.tr.setNodeMarkup(pos, undefined, {
          ...editor.view.state.doc.nodeAt(pos)?.attrs, ...next,
        }))
      }
      return view
    }
  },
  addCommands() {
    return {
      setVideo:
        (src) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { src } }),
    }
  },
  addStorage() {
    return {
      markdown: {
        // Serialize back to a bare URL line.
        serialize(state: { write: (s: string) => void; closeBlock: (n: unknown) => void }, node: { attrs: { src: string } }) {
          state.write(node.attrs.src || '')
          state.closeBlock(node)
        },
        parse: {},
      },
    }
  },
})
