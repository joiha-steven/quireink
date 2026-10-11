// Shared by the theme checker's tests only; nothing in the engine imports it.

import { checkThemeCss } from '@/theme/check-css'
import type { ThemeContract, ThemeRule, Violation } from '@/theme/types'

export const CONTRACT: ThemeContract = {
  classes: new Set(['post', 'post-list', 'prose', 'site-header', 'fc', 'fc-title', 'front', 'x']),
  ids: new Set(['comments', 'main']),
  attributes: new Set(['data-palette', 'data-look']),
  surfaceOf: new Map([
    ['.post', 'blog'],
    ['.post-list', 'blog'],
    ['#comments', 'blog'],
    ['.fc', 'front'],
    ['.fc-title', 'front'],
    ['.front', 'front'],
  ]),
  vars: new Set([
    '--c-bg', '--c-text', '--c-heading', '--c-meta', '--c-link', '--c-rule', '--c-accent',
    '--fs-body', '--fs-small', '--fs-h1',
    '--font-reading', '--font-sans', '--font-mono', '--font-display',
  ]),
}

export const PACKAGE_FILES: ReadonlySet<string> = new Set([
  'theme.json', 'theme.css', 'screenshot.webp', 'images/paper.webp', 'images/a b.png', 'fonts/body.woff2',
])

/** Styles both surfaces with nothing else, so a snippet placed before it is judged alone. */
export const BOTH_SURFACES = '.post{color:var(--c-text)}\n.fc{color:var(--c-text)}'

/** Checks `css` followed by a clean tail on a new line, so positions in `css` read as written. */
export function check(css: string, packageFiles: ReadonlySet<string> = PACKAGE_FILES): Violation[] {
  return checkThemeCss(`${css}\n${BOTH_SURFACES}`, CONTRACT, packageFiles)
}

/** The findings as `RULE line:col subject`, which reads well in a failed expectation. */
export function brief(vs: readonly Violation[]): string[] {
  return vs.map((v) => `${v.rule} ${v.line}:${v.col} ${v.subject}`)
}

export function rulesOf(vs: readonly Violation[]): ThemeRule[] {
  return vs.map((v) => v.rule)
}
