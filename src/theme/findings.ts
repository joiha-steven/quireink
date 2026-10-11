// Collects violations for one file, with positions and subjects worked out once.

import { lineLocator } from '@/theme/line-locator'
import type { ThemeRule, Violation } from '@/theme/types'

export const SUBJECT_MAX = 80
/**
 * Findings kept per file. Past it the list ends with one X1 'truncated': nobody fixes the
 * 201st finding before the first, and a hostile sheet of 64 KB of `}` would otherwise hand
 * the admin 65,000 of them.
 */
export const MAX_FINDINGS = 200

/** Whitespace collapsed, trimmed, cut to 80 code points so a surrogate pair is never split. */
export function subjectOf(text: string): string {
  return Array.from(text.replace(/\s+/g, ' ').trim()).slice(0, SUBJECT_MAX).join('')
}

export class Findings {
  readonly #src: string
  readonly #file: string
  readonly #locate: (offset: number) => { line: number; col: number }
  readonly #seen = new Set<string>()
  readonly #out: Violation[] = []
  #truncated = false

  constructor(src: string, file: string) {
    this.#src = src
    this.#file = file
    this.#locate = lineLocator(src)
  }

  /** One finding per rule per starting offset: two paths to the same token report it once. */
  add(rule: ThemeRule, start: number, end: number): void {
    const key = `${rule}@${start}`
    if (this.#seen.has(key)) return
    if (this.#out.length >= MAX_FINDINGS) {
      this.#truncated = true
      return
    }
    this.#seen.add(key)
    const { line, col } = this.#locate(start)
    this.#out.push({ rule, file: this.#file, line, col, subject: subjectOf(this.#src.slice(start, end)) })
  }

  /** A finding with no place in the text, such as a surface no rule styles. */
  addUnplaced(rule: ThemeRule, subject: string): void {
    if (this.#out.length >= MAX_FINDINGS) {
      this.#truncated = true
      return
    }
    this.#out.push({ rule, file: this.#file, line: 0, col: 0, subject: subjectOf(subject) })
  }

  list(): Violation[] {
    const sorted = [...this.#out].sort((a, b) => a.line - b.line || a.col - b.col || a.rule.localeCompare(b.rule))
    if (this.#truncated) sorted.push({ rule: 'X1', file: this.#file, line: 0, col: 0, subject: 'truncated' })
    return sorted
  }
}
