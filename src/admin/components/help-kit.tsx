// Shared bits for the Help screen. Split out so `HelpGuide` (the shell) and
// `HelpSections` (the content) can both use them without either file growing past the
// 400-line cap.
//
// Body copy here is ENGLISH BY DESIGN — it mirrors the repo docs, which are the
// canonical source. Only the nav label + page title come from `adminT`.
import Link from '@/admin/router'
import type { ReactNode } from 'react'
import { A, CODE, LINKS } from '@/admin-shared/kit'

// The strings and the two constants moved to `@/admin-shared` when Help became a page
// (ADR 0054); the server writes the same markup from them. Re-exported, so the dashboard and
// the what's-new panel — which use the components below — keep the import they had.
export { REPO, doc } from '@/admin-shared/help'
export { A, P, UL } from '@/admin-shared/kit'

export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={A}>{children}</a>
}

export function In({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className={A}>{children}</Link>
}

// A row of quick links closing a section.
export function Links({ children }: { children: ReactNode }) {
  return <p className={LINKS}>{children}</p>
}

// Inline literal — syntax, a path, a setting name. One style, used everywhere here.
export function C({ children }: { children: ReactNode }) {
  return (
    <code className={CODE}>{children}</code>
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
