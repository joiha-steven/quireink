// WHERE THE ADMIN CAN GO, and in what order.
//
// Lifted out of `AdminSidebar` when that file reached its 400-line cap. It is a clean seam
// rather than a convenient one: the rail's BEHAVIOUR (collapse, the drawer, the icon
// switch, the remembered group) is one subject, and the list of places it can send you is
// another. Only the second changes when a screen is added.
import type { ReactNode } from 'react'
import type { AdminStrings } from '@/i18n/admin-i18n'
import {
  IconHome, IconAnalytics, IconContent, IconComment, IconMedia, IconNewsletter,
  IconTrash, IconSettings, IconLog, IconHelp, IconAssistant,
} from './navIcons'

export type Destination = { href: string; label: string; icon: ReactNode }

const assistant = (t: AdminStrings): Destination =>
  ({ href: '/admin/assistant', label: t.navAssistant, icon: <IconAssistant /> })

/**
 * Four destinations, and everything else one click further (ADR 0024 step 6).
 *
 * The rail held eleven rows, which is eleven decisions before the one that matters. These
 * four are what the owner is here to do: see how it went, write, put a picture in, send it
 * out. **Analytics is not among them and that is the point** — the numbers moved onto the
 * home screen, so the rail no longer offers a second door to them.
 *
 * The assistant is the one row that comes and goes, and it comes SECOND. The rule that the
 * rail is four is not a formality (the tour has failed a fifth row before), so the fifth
 * needs an argument, and here it is the owner's own act: nobody pastes an API key for a
 * screen they meant to visit twice a month. Until they do, it is a door onto a refusal.
 */
export function primaryNav(t: AdminStrings, aiConfigured: boolean): Destination[] {
  return [
    { href: '/admin', label: t.navHome, icon: <IconHome /> },
    ...(aiConfigured ? [assistant(t)] : []),
    { href: '/admin/content', label: t.navWrite, icon: <IconContent /> },
    { href: '/admin/media', label: t.navMedia, icon: <IconMedia /> },
    { href: '/admin/newsletter', label: t.navNewsletter, icon: <IconNewsletter /> },
  ]
}

/**
 * Everything that is not writing. Not removed, moved.
 *
 * The assistant appears here only while no model is configured, and never in both lists:
 * a row in two places is a rail that answers "where is it?" twice, differently.
 */
export function secondaryNav(t: AdminStrings, aiConfigured: boolean): Destination[] {
  return [
    ...(aiConfigured ? [] : [assistant(t)]),
    { href: '/admin/analytics', label: t.navAnalytics, icon: <IconAnalytics /> },
    { href: '/admin/comments', label: t.commentsNavTitle, icon: <IconComment /> },
    { href: '/admin/trash', label: t.navTrash, icon: <IconTrash /> },
    { href: '/admin/settings', label: t.navSettings, icon: <IconSettings /> },
    { href: '/admin/log', label: t.navLog, icon: <IconLog /> },
    { href: '/admin/help', label: t.navHelp, icon: <IconHelp /> },
  ]
}
