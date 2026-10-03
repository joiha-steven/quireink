// THE TWO LISTS EVERY ADMIN PAGE CARRIES HIDDEN, as the class names their rows wear.
//
// The command palette (`web/admin/overlays.ts`, on every admin page) and the settings finder
// (`screens/settings-shell.ts`) are drawn whole and narrowed with `hidden`, because the server
// holds the dictionary and the islands do not. That is about 130 rows on every page and 113 more
// on Settings, so a row's class list is paid that many times over for a list most visits never
// open: measured 2026-10-03 on the settings screen, about 50 KB of the page was these rows'
// classes. Components (`component.ts`), and shared, because the palette's island draws post hits
// in the same row (`admin/island/lib/overlay-palette.ts`) and the two faces must not drift.
//
// Framework-free, like everything in this directory (see the head of `kit.ts`).
import { component } from '@/admin-shared/component'

/** One option in a found list: the name at the left, where it lives at the right. */
export const FOUND_ROW = component('kit-found-row', 'flex cursor-pointer items-baseline justify-between gap-4 px-4 py-2 text-sm')
/** The settings finder's row, which is a button inside its option and so carries its own hover. */
export const FOUND_KEY = component('kit-found-key',
  'flex w-full items-baseline justify-between gap-4 px-4 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/60')
export const FOUND_NAME = component('kit-found-name', 'min-w-0 truncate text-neutral-900 dark:text-white')
export const FOUND_WHERE = component('kit-found-where', 'shrink-0 text-xs text-neutral-500 dark:text-neutral-400')
