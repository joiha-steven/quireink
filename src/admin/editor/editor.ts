// THE EDITOR THE REST OF THE ADMIN TALKS TO (ADR 0054 step 7).
//
// A `ProseMirror.EditorView` with a schema, a plugin stack and a vocabulary — and a surface that
// is deliberately the one the chrome already used. `editor.chain().focus().toggleBold().run()`
// is written in thirty-one places; `editor.isActive('heading', { level: 2 })` in fourteen. Those
// are the product's own words for what its buttons do. Keeping them is what let the layer
// underneath be replaced without touching a single call site, and it is the reason the diff for
// this step is a new directory rather than a rewrite of the toolbar.
//
// ⚠️ WHAT IT IS NOT IS A REIMPLEMENTATION OF THE WRAPPER. There is no extension system, no
// priority number, no per-extension storage, no `configure`. The plugin stack is a list in
// `plugins.ts`, the schema is a file, and the commands are a table. A name that is not in that
// table cannot be called, which is the point.
import { EditorState, Plugin, PluginKey, TextSelection, type Transaction } from 'prosemirror-state'
import { EditorView, type EditorProps, type NodeViewConstructor } from 'prosemirror-view'
import type { Node as PMNode } from 'prosemirror-model'
import { DOMSerializer } from 'prosemirror-model'
import { schema } from './schema'
import { editorPlugins } from './plugins'
import { chainOn, runOne, type Chain, type Cmd } from './run'
import { COMMANDS, type CommandName } from './commands'
import { markActive, markAttrs } from './commands-marks'
import { nodeActive, nodeAttrs } from './commands-blocks'
import { contentToNodes } from './commands-doc'
import { documentToMarkdown } from '@/admin/components/MarkdownBridge'

type Args<K extends CommandName> = Parameters<(typeof COMMANDS)[K]>

/** `editor.commands.x(…)` — one command, dispatched on its own. */
export type Commands = { [K in CommandName]: (...args: Args<K>) => boolean } & {
  focus: (at?: number) => boolean
}
/** `editor.chain().x(…).y(…).run()` — several commands, one edit. */
export type Chained = { [K in CommandName]: (...args: Args<K>) => Chained } & {
  run: () => boolean
  focus: (at?: number) => Chained
}

export type EditorEvent = 'update' | 'selectionUpdate' | 'transaction' | 'focus' | 'blur' | 'destroy'

export type EditorOptions = {
  element: HTMLElement
  /** Markdown, or ProseMirror JSON. A string is parsed by the product's own engine. */
  content?: string | unknown
  placeholder?: string
  askLink?: (previous: string) => Promise<string | null>
  /** Anything mounted on top of the stack. The bubble bar arrives this way, after the fact. */
  plugins?: Plugin[]
  nodeViews?: Record<string, NodeViewConstructor>
  editorProps?: EditorProps
  editable?: boolean
}

export class Editor {
  readonly view: EditorView
  readonly schema = schema
  /** What the caller passed, kept as they passed it — a dirty check reads this. */
  readonly options: { content: unknown }
  private readonly listeners = new Map<EditorEvent, Set<(payload: never) => void>>()
  private dead = false

  constructor(opts: EditorOptions) {
    this.options = { content: opts.content ?? '' }
    const nodes = contentToNodes(opts.content ?? '')
    const doc = schema.topNodeType.create(
      null,
      nodes.length ? nodes : schema.nodes.paragraph!.create(),
    )
    const state = EditorState.create({
      doc,
      plugins: editorPlugins({
        placeholder: opts.placeholder ?? '',
        askLink: opts.askLink ?? (async () => null),
        extra: opts.plugins,
      }),
    })
    this.view = new EditorView(opts.element, {
      state,
      editable: () => opts.editable ?? true,
      nodeViews: opts.nodeViews,
      ...opts.editorProps,
      // ⚠️ THE EVENTS GO OUT AFTER THE STATE IS UPDATED, not before. A listener that asks the
      // editor a question — and the save listener does, on every keystroke — must be told about
      // a document that is already there.
      dispatchTransaction: (tr) => {
        if (this.dead) return
        const next = this.view.state.apply(tr)
        this.view.updateState(next)
        this.emit('transaction', { editor: this, transaction: tr })
        if (tr.docChanged) this.emit('update', { editor: this, transaction: tr })
        if (tr.selectionSet || tr.docChanged) this.emit('selectionUpdate', { editor: this })
      },
      handleDOMEvents: {
        focus: () => { this.emit('focus', { editor: this }); return false },
        blur: () => { this.emit('blur', { editor: this }); return false },
        ...(opts.editorProps?.handleDOMEvents ?? {}),
      },
    })
    this.commands = this.makeCommands()
  }

  get state(): EditorState { return this.view.state }
  get isDestroyed(): boolean { return this.dead }
  get isEditable(): boolean { return this.view.editable }
  get isFocused(): boolean { return this.view.hasFocus() }
  /** One empty paragraph and nothing else — which is what a blank piece looks like. */
  get isEmpty(): boolean {
    const doc = this.state.doc
    return doc.childCount === 1 && doc.firstChild?.type === schema.nodes.paragraph
      && doc.firstChild.content.size === 0
  }

  readonly commands: Commands

  private makeCommands(): Commands {
    const out = {} as Commands
    for (const name of Object.keys(COMMANDS) as CommandName[]) {
      out[name] = ((...args: never[]) =>
        runOne(this.view, (COMMANDS[name] as (...a: never[]) => Cmd)(...args))) as never
    }
    // `focus` is not in the table because it is not a command: it takes the keyboard, which is
    // a DOM act, and optionally moves the caret, which is not. Both halves, in that order, so
    // that `focus(pos)` also scrolls the caret into view — which is the pair of things the
    // Markdown switch relies on.
    ;(out as { focus: (at?: number) => boolean }).focus = (at?: number) => {
      this.view.focus()
      if (at != null) this.commands.setTextSelection(at)
      return true
    }
    return out
  }

  /** Several commands, one transaction, one entry in the undo history. */
  chain(): Chained { return this.fluent(chainOn(this.view)) }

  /** Whether the same chain WOULD succeed, changing nothing. */
  can(): Chained { return this.fluent(chainOn(this.view, true)) }

  private fluent(chain: Chain): Chained {
    const proxy = {} as Chained
    for (const name of Object.keys(COMMANDS) as CommandName[]) {
      proxy[name] = ((...args: never[]) => {
        chain.cmd((COMMANDS[name] as (...a: never[]) => Cmd)(...args))
        return proxy
      }) as never
    }
    /**
     * ⚠️ `focus` IS HALF A COMMAND AND HALF A DOM CALL, and both halves have to happen at the
     * right moment. Moving the caret is a step in the transaction like any other, so it goes
     * into the chain; taking the keyboard is not, and doing it BEFORE the transaction is
     * dispatched makes the browser put the selection back where the DOM still has it, undoing
     * the step that has not been applied yet. So the DOM half waits for `run()`.
     */
    let wantFocus = false
    proxy.focus = (at?: number) => {
      wantFocus = true
      if (at != null) {
        chain.cmd((state, dispatch) => {
          if (dispatch) {
            const p = Math.max(0, Math.min(at, state.doc.content.size))
            dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(p))))
          }
          return true
        })
      }
      return proxy
    }
    proxy.run = () => {
      const ok = chain.run()
      if (ok && wantFocus) this.view.focus()
      return ok
    }
    return proxy
  }

  /** Whether a mark or a node is on at the selection. The toolbar's every lit key. */
  isActive(name: string, attrs?: Record<string, unknown>): boolean {
    if (schema.marks[name]) return markActive(this.state, name, attrs)
    if (schema.nodes[name]) return nodeActive(this.state, name, attrs)
    return false
  }

  /** A mark's or a node's attributes at the selection. */
  getAttributes(name: string): Record<string, unknown> {
    if (schema.marks[name]) return markAttrs(this.state, name)
    if (schema.nodes[name]) return nodeAttrs(this.state, name)
    return {}
  }

  /**
   * The document as Markdown.
   *
   * ⚠️ IT WAS `editor.storage.markdown.getMarkdown()`, and the indirection was the wrapper's,
   * not the product's: an extension had no other way to hang a method on the editor. There is
   * no extension system here, so this is a method.
   */
  getMarkdown(): string { return documentToMarkdown(this.state.doc) }

  getText(): string { return this.state.doc.textBetween(0, this.state.doc.content.size, '\n') }

  /** The document as HTML. Used by two tests and by nothing the writer can reach. */
  getHTML(): string {
    const frag = DOMSerializer.fromSchema(schema).serializeFragment(this.state.doc.content)
    const box = document.createElement('div')
    box.appendChild(frag)
    return box.innerHTML
  }

  focus(): void { this.view.focus() }

  /** A plugin added after the fact. The find strip mounts and unmounts its own. */
  registerPlugin(plugin: Plugin): void {
    this.view.updateState(this.state.reconfigure({ plugins: [...this.state.plugins, plugin] }))
  }

  /**
   * A plugin taken off again. By the plugin, or by its key's NAME.
   *
   * ⚠️ A `PluginKey`'S `key` IS NOT ITS NAME. ProseMirror appends a counter — `quireBubbleBar$`
   * or `quireBubbleBar$3` — so that two plugins made from the same name are still distinct, and
   * comparing a caller's plain string against it never matches. The prefix before the `$` is
   * what a caller means.
   */
  unregisterPlugin(key: string | PluginKey | { key: string } | Plugin): void {
    const name = typeof key === 'string'
      ? key
      : typeof (key as { key?: string }).key === 'string' ? (key as { key: string }).key : null
    this.view.updateState(this.state.reconfigure({
      plugins: this.state.plugins.filter((p) => {
        if (!name) return p !== key
        const own = (p as unknown as { key?: string }).key ?? ''
        return own !== name && own.split('$')[0] !== name.split('$')[0]
      }),
    }))
  }

  on<T = unknown>(event: EditorEvent, fn: (payload: T) => void): void {
    const set = this.listeners.get(event) ?? new Set()
    set.add(fn as never)
    this.listeners.set(event, set)
  }

  off<T = unknown>(event: EditorEvent, fn: (payload: T) => void): void {
    this.listeners.get(event)?.delete(fn as never)
  }

  private emit(event: EditorEvent, payload: unknown): void {
    for (const fn of this.listeners.get(event) ?? []) (fn as (p: unknown) => void)(payload)
  }

  destroy(): void {
    if (this.dead) return
    this.dead = true
    this.emit('destroy', { editor: this })
    this.listeners.clear()
    this.view.destroy()
  }
}

export type { PMNode, Transaction }
