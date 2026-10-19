// The button row over the writing surface.
//
// ⚠️ PLAIN TYPESCRIPT, not React, and ADR 0054 is why it is allowed to be built here rather
// than rendered by the server like the rest of the admin: the editor is a client-side
// APPLICATION, not a page. Everything in this file is chrome that only exists while ProseMirror
// is running.
//
// ⚠️ AND IT IS THE REASON THE WHOLE TREE USED TO REDRAW. Twenty-one `isActive` questions were
// asked here on every render, and the editor was set to re-render on every transaction so the
// answers stayed live — which means every keystroke rebuilt the React tree of the entire sheet
// to decide whether Bold looks pressed. Now one subscription updates twenty-one attributes.
import type { Editor } from '@/admin/editor/editor'
import type { SheetWords } from '@/admin-shared/sheet-wire'
import { ICONS } from '@/icons'

/** The bar's own SVG size, on the shared builder. */
const glyph = (body: string): SVGSVGElement => svgGlyph(body, className.glyph)
import { el, svgGlyph } from './node-dom'
import { withTip } from './editor-tooltip'
import { editLink } from './editor-link'
import { tip } from './editorKeys'
import { mountMore, type RowCluster } from './toolbar-more'
import { TOOLBAR_MIDDLE, TOOLBAR_RUN, TOOLBAR_STRIP } from '@/admin-shared/toolbar-shape'

/**
 * EVERY CLASS THIS FILE WRITES, IN ONE TABLE — see `CaptionedImage.ts` for why the name is
 * load-bearing: `check:admin-css` reads the whole balanced expression after a `className` and
 * proves the stylesheet has a rule for each of these.
 */
const className = {
  key: 'grid h-9 min-w-9 shrink-0 place-items-center rounded-md px-1 text-sm'
    + ' hover:bg-white dark:hover:bg-neutral-700',
  // Pressed. A background alone is not enough on a bar of glyphs, so it takes an inner shadow
  // and a hairline as well.
  keyOn: 'bg-white text-neutral-950 shadow-[inset_0_1.5px_2px_rgba(0,0,0,.14)] ring-1'
    + ' ring-neutral-200 dark:bg-neutral-700 dark:text-white'
    + ' dark:shadow-[inset_0_1.5px_2px_rgba(0,0,0,.5)] dark:ring-neutral-600',
  keyOff: 'text-neutral-600 dark:text-neutral-300',
  /**
   * A LINE OF THE BAR: the full width of the sheet, its buttons in the middle of it.
   *
   * `px-4` and not the 10px it had, so the first button stands on the same left edge as the
   * action line above it. Measured at 1440: that line's first control sat at 273 and this one's
   * at 267, which is one sheet with two left edges six pixels apart.
   *
   * ⚠️ ONE ROW AT EVERY WIDTH: it scrolls on a phone, and on a desktop what does not fit goes
   * behind "More" (`toolbar-more.ts`). Measured at 390x844 on 2026-09-07: this strip wrapped to 125px
   * and the action bar above it to 139, so a post's title began 378px down — 45% of the screen
   * was chrome before the first word. A writer scrolls a strip of tools sideways in every
   * application they have ever used, and they cannot scroll the paper back up past chrome that
   * is stuck to it.
   */
  strip: TOOLBAR_STRIP,
  middle: TOOLBAR_MIDDLE,
  /**
   * The run of buttons inside a line. `w-max` shrinks it to its content, so the strip's
   * `justify-center` has something to centre; `max-w-full` caps it at the sheet. It never
   * wraps: `toolbar-more.ts` takes clusters off its end until it fits, and while any are off the strip
   * drops `justify-center`, so the row starts on the action line's left edge with More at its
   * end rather than floating in the middle of the sheet.
   */
  run: TOOLBAR_RUN,
  /**
   * One cluster, which moves behind More as a whole. The gap between clusters was 13px with a
   * hairline, 12px without, and is 8px since 2026-09-30: at 1280 the fifth cluster wrapped to a
   * second 48px row for want of 8px, which is the width it still fits in on one row.
   */
  group: 'flex items-center gap-0.5',
  bar: 'sticky z-10 border-b border-neutral-200/70 bg-neutral-50/80 backdrop-blur-xl'
    + ' dark:border-neutral-800 dark:bg-neutral-950/60',
  tableRow: 'border-t border-neutral-200/60 dark:border-neutral-800/80',
  glyph: 'h-[18px] w-[18px]',
  small: 'text-xs font-medium',
  // Heavier than the icons beside them on purpose (`check:admin-kit` OFF_SCALE_OK): these are
  // letters standing in for glyphs.
  bold: 'text-xs font-bold',
  ring: 'inline-block rounded-full border border-current px-1 leading-tight',
}

/** The twenty-six words the bar prints, which a module outside React cannot look up. */
export type ToolbarWords = {
  more: string
  bold: string; italic: string; underline: string; ring: string; strike: string; codeInline: string
  paragraph: string; heading: string
  list: string; listNumbered: string; task: string
  quote: string; codeBlock: string; divider: string
  link: string; image: string; gallery: string; table: string
  math: string; mathInline: string
  colAdd: string; colDel: string; rowAdd: string; rowDel: string; tableDelete: string
}

export type ToolbarHooks = {
  editor: Editor
  words: ToolbarWords
  /** Opens the product's link box and resolves to a URL, '' to unlink, or null on a back-out. */
  askLink: (previous: string) => Promise<string | null>
  onPickImage: () => void
  onPickGallery: () => void
}

/** One key of the bar: what it says, what it does, and what makes it look pressed. */
type Key = {
  /** What the key is called. The tooltip adds the chord; the More menu prints it in a column. */
  name: string
  /** The key's id in the shortcut table (`editorKeys.ts`), when it has a chord. */
  chord?: string
  /** The node or mark `isActive` is asked about, with its attributes. Absent = never pressed. */
  on?: [string] | [string, Record<string, unknown>]
  run: () => void
  face: () => Node
}

export type Toolbar = {
  /** The sticky band above the bar is measured at runtime, so the offset arrives late. */
  setTop: (px: number) => void
  destroy: () => void
}

export function mountToolbar(host: HTMLElement, hooks: ToolbarHooks): Toolbar {
  const { editor, words: w } = hooks
  const chain = () => editor.chain().focus()
  const text = (s: string, cls?: string): Node => {
    const span = el('span', cls ? { className: cls } : {})
    span.textContent = s
    return span
  }
  const tag = (name: 'strong' | 'em' | 'u' | 's' | 'code', s: string): Node => {
    const node = el(name)
    node.textContent = s
    return node
  }

  const marks: Key[] = [
    { name: w.bold, chord: 'bold', on: ['bold'], run: () => chain().toggleBold().run(), face: () => tag('strong', 'B') },
    { name: w.italic, chord: 'italic', on: ['italic'], run: () => chain().toggleItalic().run(), face: () => tag('em', 'I') },
    { name: w.underline, chord: 'underline', on: ['underline'], run: () => chain().toggleUnderline().run(), face: () => tag('u', 'U') },
    { name: w.ring, chord: 'ring', on: ['ring'], run: () => chain().toggleRing().run(), face: () => text('O', className.ring) },
    { name: w.strike, chord: 'strike', on: ['strike'], run: () => chain().toggleStrike().run(), face: () => tag('s', 'S') },
    { name: w.codeInline, chord: 'code', on: ['code'], run: () => chain().toggleCode().run(), face: () => tag('code', '`') },
  ]

  const blocks: Key[] = [
    { name: w.paragraph, on: ['paragraph'], run: () => chain().setParagraph().run(), face: () => text('P') },
    ...([1, 2, 3, 4, 5] as const).map((level): Key => ({
      name: `${w.heading} ${level}`,
      on: ['heading', { level }],
      run: () => chain().toggleHeading({ level }).run(),
      face: () => text(`H${level}`, className.small),
    })),
  ]

  const lists: Key[] = [
    {
      name: w.list, chord: 'bulletList', on: ['bulletList'], run: () => chain().toggleBulletList().run(),
      face: () => glyph('<circle cx="5" cy="7" r="1" fill="currentColor" stroke="none"/>'
        + '<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/>'
        + '<circle cx="5" cy="17" r="1" fill="currentColor" stroke="none"/>'
        + '<path d="M9 7h10M9 12h10M9 17h10"/>'),
    },
    {
      name: w.listNumbered, chord: 'orderedList', on: ['orderedList'], run: () => chain().toggleOrderedList().run(),
      face: () => glyph('<path d="M4 6h2v4M4 14h2l-2 4h2M10 7h10M10 12h10M10 17h10"/>'),
    },
    {
      name: w.task, chord: 'taskList', on: ['taskList'], run: () => chain().toggleTaskList().run(),
      face: () => glyph('<rect x="3.5" y="4.5" width="6" height="6" rx="1"/>'
        + '<path d="m5 7 1.5 1.5L9 5.5M13 7h7M4 16h5M13 16h7"/>'),
    },
  ]

  // LISTS end, BLOCKS begin: one run of five held two ideas.
  const shapes: Key[] = [
    {
      name: w.quote, chord: 'blockquote', on: ['blockquote'], run: () => chain().toggleBlockquote().run(),
      face: () => glyph('<path d="M7 8H4v4h4v4H4M17 8h-3v4h4v4h-4"/>'),
    },
    {
      name: w.codeBlock, chord: 'codeBlock', on: ['codeBlock'], run: () => chain().toggleCodeBlock().run(),
      face: () => glyph('<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>'),
    },
    { name: w.divider, run: () => chain().setHorizontalRule().run(), face: () => glyph('<path d="M4 12h16"/>') },
  ]

  const inserts: Key[] = [
    {
      name: w.link, chord: 'link', on: ['link'],
      run: () => { void editLink(editor, hooks.askLink) },
      face: () => glyph(ICONS.link),
    },
    {
      name: w.image, run: hooks.onPickImage,
      face: () => glyph('<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/>'
        + '<circle cx="8" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 3-3 4 4"/>'),
    },
    {
      name: w.gallery, run: hooks.onPickGallery,
      face: () => glyph('<rect x="5" y="5" width="14" height="14" rx="1.5"/>'
        + '<path d="M8 5V3h13v13h-2M6 16l4-4 3 3 2-2 4 4"/>'),
    },
    {
      name: w.table, run: () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      face: () => glyph('<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/>'
        + '<path d="M3.5 10h17M9 4.5v15M15 4.5v15"/>'),
    },
    // Two buttons, not one behind a menu. Display and inline are not two settings of one thing:
    // a standalone equation and a symbol inside a sentence are different gestures, the same
    // argument the five pens make against a colour dropdown. Both drop an EMPTY formula with the
    // caret in its box, so the next thing typed is the TeX. The glyph is a pi, and the LINES
    // AROUND IT carry the distinction: full rules above and below for a formula on its own line,
    // a dash either side for one sitting in a sentence. Chosen by rendering the candidates at
    // 24px and looking — an earlier pair read as "I×" and "×≠", and a sigma at this size comes
    // out as the digit 3.
    {
      name: w.math, on: ['mathBlock'], run: () => chain().setMath(true).run(),
      face: () => glyph('<path d="M4 4.5h16M4 19.5h16"/><path d="M7.5 9.5h9M10 9.5v5M14 9.5v5"/>'),
    },
    {
      name: w.mathInline, on: ['mathInline'], run: () => chain().setMath(false).run(),
      face: () => glyph('<path d="M3 12h3M18 12h3"/><path d="M8 9h8M10.5 9v6M14.5 9v6"/>'),
    },
  ]

  const tableKeys: Key[] = [
    { name: w.colAdd, run: () => chain().addColumnAfter().run(), face: () => text('C+', className.bold) },
    { name: w.colDel, run: () => chain().deleteColumn().run(), face: () => text('C−', className.bold) },
    { name: w.rowAdd, run: () => chain().addRowAfter().run(), face: () => text('R+', className.bold) },
    { name: w.rowDel, run: () => chain().deleteRow().run(), face: () => text('R−', className.bold) },
    { name: w.tableDelete, run: () => chain().deleteTable().run(), face: () => glyph(ICONS.trash) },
  ]

  /** Every key that can look pressed, so one pass can answer for all of them. */
  const lit: { key: Key; button: HTMLButtonElement }[] = []

  const isOn = (key: Key): boolean => {
    if (!key.on) return false
    const [name, attrs] = key.on
    return attrs ? editor.isActive(name, attrs) : editor.isActive(name)
  }

  const draw = (key: Key): HTMLElement => {
    const label = key.chord ? tip(key.name, key.chord) : key.name
    const button = el('button', { className: className.key, type: 'button', title: label, 'aria-label': label })
    button.appendChild(key.face())
    button.addEventListener('click', key.run)
    if (key.on) lit.push({ key, button })
    // `Tip` draws the label in this product's type after 400ms; `title` stays for touch.
    return withTip(button, label)
  }

  const cluster = (keys: Key[]): RowCluster<Key> => {
    const box = el('span', { className: className.group, 'data-toolbar-cluster': '' })
    const drawn = keys.map((key) => ({ key, box: draw(key) }))
    for (const { box: keyBox } of drawn) box.appendChild(keyBox)
    return { box, keys: drawn }
  }

  const bar = el('div', { className: className.bar })
  const line = el('div', { className: `${className.strip} ${className.middle}` })
  const run = el('div', { className: className.run })
  const clusters = [marks, blocks, lists, shapes, inserts].map(cluster)
  for (const { box } of clusters) run.appendChild(box)
  // What does not fit on the row goes behind More, at its end (`toolbar-more.ts`).
  const more = mountMore({
    bar, line, run, clusters, word: w.more, middle: className.middle, glyph: glyph(ICONS.more), isOn,
    key: { base: className.key, on: className.keyOn, off: className.keyOff },
  })
  run.appendChild(more.box)
  line.appendChild(run)

  /**
   * THE TABLE'S OWN TOOLS, ON THEIR OWN LINE, and the line is what makes the bar above hold
   * still. Ranged left, where every other row of chrome on this sheet starts. They used to join
   * the end of the run above, which moved every button in it: measured 2026-09-12 at 1440,
   * putting the caret in a table slid the whole row 62.5px left and taking it out slid it back,
   * so the button a hand was travelling towards was somewhere else by the time it arrived.
   *
   * ⚠️ DRAWN ALWAYS, HIDDEN WHEN THERE IS NO TABLE. A hidden node is still a node, but it takes
   * no space and no rule here counts position (`docs/admin-one-dom.md`, trap 4).
   */
  const tableLine = el('div', { className: `${className.strip} ${className.tableRow}` })
  const tableRun = el('div', { className: className.run })
  for (const key of tableKeys) tableRun.appendChild(draw(key))
  tableLine.appendChild(tableRun)
  tableLine.hidden = true

  bar.append(line, tableLine, more.menu)
  // REPLACES what the server drew there: a blank row of the bar's height, held so the paper
  // does not drop when this lands (`web/admin/screens/sheet.ts`).
  host.replaceChildren(bar)
  more.start()

  const sync = (): void => {
    for (const { key, button } of lit) {
      const on = isOn(key)
      // `aria-pressed` is REMOVED rather than set to false, which is what the React bar did
      // (`active || undefined`): a bar of twenty-five keys that all announce "not pressed" is
      // noise, and only the ones that can be pressed should say so.
      if (on) button.setAttribute('aria-pressed', 'true')
      else button.removeAttribute('aria-pressed')
      button.className = `${className.key} ${on ? className.keyOn : className.keyOff}`
    }
    more.repaint()
    tableLine.hidden = !editor.isActive('table')
  }
  sync()
  editor.on('transaction', sync)

  return {
    setTop: (px: number) => { bar.style.top = `${px}px` },
    destroy: () => {
      editor.off('transaction', sync)
      more.destroy()
      bar.remove()
    },
  }
}

/**
 * The bar's words out of the admin's dictionary.
 *
 * Here rather than at the call site because the mapping IS the bar's business: twenty-six
 * names, and the file that prints them is the one that should say which key each belongs to.
 * A type-only import, so no dictionary ships with it.
 */
export function toolbarWords(t: SheetWords): ToolbarWords {
  return {
    more: t.tbMore,
    bold: t.tbBold, italic: t.tbItalic, underline: t.tbUnderline, ring: t.tbRing,
    strike: t.tbStrike, codeInline: t.tbCodeInline,
    paragraph: t.tbParagraph, heading: t.tbHeading,
    list: t.tbList, listNumbered: t.tbListNumbered, task: t.tbTask,
    quote: t.tbQuote, codeBlock: t.tbCodeBlock, divider: t.tbDivider,
    link: t.tbLink, image: t.tbImage, gallery: t.tbGallery, table: t.tbTable,
    math: t.tbMath, mathInline: t.tbMathInline,
    colAdd: t.tbColAdd, colDel: t.tbColDel, rowAdd: t.tbRowAdd, rowDel: t.tbRowDel,
    tableDelete: t.tbTableDelete,
  }
}
