// Shared bits for the Help screen. Split out so `HelpGuide` (the shell) and
// `HelpSections` (the content) can both use them without either file growing past the
// 400-line cap.
//
// Body copy here is ENGLISH BY DESIGN — it mirrors the repo docs, which are the
// canonical source. Only the nav label + page title come from `adminT`.
import Link from '@/admin/router'
import type { ReactNode } from 'react'

export const REPO = 'https://github.com/joiha-steven/quireink'
export const doc = (p: string) => `${REPO}/blob/main/${p}`

export const A =
  'text-neutral-900 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-600 dark:text-neutral-100 dark:decoration-neutral-600 dark:hover:decoration-neutral-300'
export const P = 'text-sm leading-relaxed text-neutral-600 dark:text-neutral-300'
export const UL = `${P} space-y-2 list-disc pl-4`

export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={A}>{children}</a>
}

export function In({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className={A}>{children}</Link>
}

// A row of quick links closing a section.
export function Links({ children }: { children: ReactNode }) {
  return <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-500 dark:text-neutral-400">{children}</p>
}

// Inline literal — syntax, a path, a setting name. One style, used everywhere here.
export function C({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[0.8125rem] text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
      {children}
    </code>
  )
}

// Anchor target + scroll offset, so the index chips land the heading below the sticky
// admin chrome instead of under it. `break-inside-avoid` keeps a card whole when the
// section grid is laid out in CSS columns (see HelpGuide) — without it a card can be
// sliced across the column break.
export function Anchor({ id, children }: { id: string; children: ReactNode }) {
  return (
    <section id={id} className="mb-4 break-inside-avoid scroll-mt-24">
      {children}
    </section>
  )
}
