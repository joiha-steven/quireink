// Lines, columns and indentation — the layer where CommonMark hides most of its traps.
//
// A Markdown parser looks like it works on strings and does not. It works on COLUMNS, and a
// tab is not a character wide: it advances to the next multiple of four, so `\tfoo` is
// indented four and `a\tfoo` is indented to column 4 from column 1. Eleven examples in the
// spec exist only to say this, and every one of them is a place where treating a tab as one
// character produces a paragraph where a code block belongs.
//
// So a line is carried as its text plus a cursor measured in columns, and everything that
// consumes part of a line moves the cursor rather than slicing the string. Slicing loses the
// column, and a container that has eaten `> ` from `>\tfoo` has to know it is now at column
// 2 of a tab that reaches column 4.

export const TAB_STOP = 4

export class Line {
  /** The text of the line, without its newline. */
  readonly text: string
  /** Where reading has reached, as an index into `text`. */
  pos = 0
  /** The column that index sits at, counting a tab to the next stop of four. */
  col = 0
  /** Set when the cursor is inside a tab that was only partly consumed. */
  partialTab = 0

  constructor(text: string) {
    this.text = text
  }

  get done(): boolean {
    return this.pos >= this.text.length
  }

  /** The character at the cursor, or '' at the end. */
  peek(offset = 0): string {
    return this.text[this.pos + offset] ?? ''
  }

  /** Everything from the cursor on, with a partly-eaten tab expanded to the spaces it left. */
  rest(): string {
    if (this.partialTab > 0) return ' '.repeat(this.partialTab) + this.text.slice(this.pos + 1)
    return this.text.slice(this.pos)
  }

  /** Step over one character, counting a tab to the next stop. */
  advance(): void {
    if (this.text[this.pos] === '\t') {
      const width = TAB_STOP - (this.col % TAB_STOP)
      this.col += width
    } else {
      this.col += 1
    }
    this.pos += 1
    this.partialTab = 0
  }

  /**
   * Move forward by up to `columns` columns of whitespace.
   *
   * Stops at the first non-space, and stops PART WAY INTO A TAB when the tab reaches past the
   * asked-for width — which is the case the whole class exists for. A four-space tab entered
   * at column 0 when two columns were asked for leaves two columns of that tab unconsumed,
   * and a list item's content starts in the middle of it.
   */
  advanceWhitespace(columns: number): void {
    let left = columns
    while (left > 0) {
      const ch = this.text[this.pos]
      if (ch === ' ') {
        this.pos += 1
        this.col += 1
        left -= 1
      } else if (ch === '\t') {
        const width = TAB_STOP - (this.col % TAB_STOP)
        if (width > left) {
          // Into the tab, not past it. The remainder stands in as spaces for whatever reads next.
          this.partialTab = width - left
          this.col += left
          left = 0
          return
        }
        this.pos += 1
        this.col += width
        left -= width
      } else {
        return
      }
    }
  }

  /** Columns of whitespace from the cursor to the first non-space. */
  indent(): number {
    let col = this.col
    let i = this.pos
    while (i < this.text.length) {
      const ch = this.text[i]
      if (ch === ' ') col += 1
      else if (ch === '\t') col += TAB_STOP - (col % TAB_STOP)
      else break
      i += 1
    }
    return col - this.col
  }

  /** Skip to the first non-space character, however many columns that is. */
  skipWhitespace(): void {
    while (this.pos < this.text.length) {
      const ch = this.text[this.pos]
      if (ch === ' ' || ch === '\t') this.advance()
      else break
    }
  }

  /** Nothing but whitespace left. */
  blank(): boolean {
    for (let i = this.pos; i < this.text.length; i++) {
      const ch = this.text[i]
      if (ch !== ' ' && ch !== '\t') return false
    }
    return true
  }

  /** A copy, so a speculative read can be thrown away. */
  clone(): Line {
    const next = new Line(this.text)
    next.pos = this.pos
    next.col = this.col
    next.partialTab = this.partialTab
    return next
  }
}

/**
 * Split a source document into lines, the way the spec says to.
 *
 * A NUL becomes U+FFFD (the spec's rule, and a security one: a NUL reaching HTML is a
 * truncation bug in whatever reads it next). The three line endings collapse to one. A final
 * newline does not make an empty last line, but a document that is only a newline has one.
 */
export function toLines(source: string): string[] {
  const clean = source.replace(/\0/g, '�')
  const lines = clean.split(/\r\n|\n|\r/)
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines
}
