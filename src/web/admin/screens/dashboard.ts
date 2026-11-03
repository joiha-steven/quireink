// The admin's front door, as HTML the server sends (ADR 0054).
//
// THE HIGHEST-VALUE CONVERSION IN THE SET, and not because it is the heaviest: it is the screen
// every visit starts on. 1,276 lines of React across seven files, of which exactly one held any
// state at all, and all of it waited for a bundle, a route chunk and a data fetch before a word
// appeared. A screen that is almost pure reading had the longest wait in the admin.
//
// A WRITING DESK, not a dashboard (2026-11-03): the page title, the unfinished writing first, then
// one line of traffic and four ruled bands on one sheet. It was a greeting by time of day with
// the owner's name, a row of 30px figures with a sparkline, eight identical white cards and a
// band of five counts: the SaaS dashboard template, block for block.
import type { SiteLang, SiteSettings } from '@/types'
import type { AdminStrings } from '@/i18n/admin-i18n'
import { adminT } from '@/i18n/admin-i18n'
import { escapeAttr, escapeHtml } from '@/utils'
import { siteDateTimeShort } from '@/admin-shared/sheet-state'
import { buttonClass } from '@/admin-shared/kit'
import { META_ON_CANVAS, TAP } from '@/admin-shared/scale'
import { relativeDay, sinceStart } from '@/admin-shared/when'
import { firstRunSteps } from '@/admin-shared/first-run'

import { REPO } from '@/admin-shared/help'
import { pageHeader, sheet } from '@/web/admin/kit'
import { band, trafficCard, widgets } from '@/web/admin/screens/dashboard-cards'
import { dashboardView } from '@/web/admin/views-home'
import { siteZone } from '@/analytics/types'

/** Where an owner with no name on the blog sets one: the tab that holds it (ADR 0041's `?tab=`). */
const NAME_HREF = '/admin/settings?tab=blog'

const VIEW_ALL = `${TAP} text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white`

/**
 * The page's title, as on every other screen: "Home" in the page face, the last publication
 * under it, and New post. It replaced a greeting by the browser's time of day with the owner's
 * name and portrait ("Good evening, The editor"), which is how a chatbot opens.
 */
function header(t: AdminStrings, settings: SiteSettings, author: { name: string }, lastPublishedAt: string | null): string {
  const when = lastPublishedAt
    ? `${t.greetLastPublished} ${relativeDay(t.greetToday, lastPublishedAt, Date.now(), settings.language)}`
    : t.greetNothingYet
  return pageHeader({
    title: t.navHome,
    descriptionHtml: escapeHtml(when)
      + (author.name.trim() ? '' : ` · <a href="${escapeAttr(NAME_HREF)}" class="${TAP} underline underline-offset-2 hover:text-neutral-900 dark:hover:text-white">${escapeHtml(t.greetSetName)}</a>`),
    actions: `<a href="/admin/editor" class="${buttonClass()}">${escapeHtml(t.newPost)}</a>`,
  })
}

/**
 * The first five minutes, with each step reading the INSTALL rather than a dismissal.
 *
 * AT 5 OF 5 IT TAKES ITSELF OFF THE SCREEN, which is the dismissal nobody has to remember to
 * perform. Both the band and the re-open link are drawn and one is hidden, so opening it again
 * is an attribute rather than a fetch — and re-opening writes nothing, because looking at the
 * steps again is not un-finishing setup.
 */
function firstRun(t: AdminStrings, done: boolean, setup: Record<string, boolean>): string {
  const flags = [setup.named, setup.published, setup.styled, setup.mail, setup.readers]
  const finished = flags.filter(Boolean).length
  if (finished === flags.length) return ''
  // `steps-down`: two columns that read DOWN, 1–3 then 4–5, so the order the steps are meant to
  // be taken in is the order the eye meets them. Row by row, a half-done list read 1, ✓, ✓, 4, ✓.
  const steps = `<ol class="steps-down grid gap-x-6 gap-y-4 sm:grid-cols-2">`
    + firstRunSteps(t).map((s, i) => `<li class="flex gap-3">`
      + (flags[i]
        // A DONE step trades its number for a tick, in INK: the number was the thing to do next,
        // and a finished step is no longer one. Not the pen (until 2026-11-03): the highlighter
        // marks where you are, and three lime discs on Home spent it on something else.
        ? `<span aria-hidden="true" data-step-done class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-900 text-xs font-semibold text-neutral-950 dark:border-neutral-100 dark:text-white">✓</span>`
        : `<span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-xs font-medium tabular-nums text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">${i + 1}</span>`)
      + `<div class="min-w-0"><a href="${escapeAttr(s.href)}" class="inline-block ${TAP} text-sm font-medium underline-offset-2 hover:underline ${flags[i] ? 'text-neutral-500 dark:text-neutral-400' : 'text-neutral-900 dark:text-neutral-100'}">${escapeHtml(s.label)}</a>`
      + `<p class="mt-0.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">${escapeHtml(s.body)}</p></div></li>`).join('')
    + `</ol>`
  // THE COUNT IS THE HEADLINE, on the card's own title row where a state belongs: it is what
  // turns five links into a path with a position on it. The bar carries no number of its own —
  // the same fact in a shape the eye reads without counting — so it is `aria-hidden`.
  const actions = `<span class="flex items-center gap-2.5">`
    + `<span class="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">`
    + `${escapeHtml(t.firstRunProgress.replace('{done}', String(finished)).replace('{total}', String(flags.length)))}</span>`
    // From sm up only: on a phone the title, the count and the bar did not fit one row and the
    // words wrapped. The count says what the bar shows, so the bar is the one that goes.
    + `<span aria-hidden="true" class="hidden h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200 sm:block dark:bg-neutral-700">`
    // ⚠️ NO TRANSITION HERE, and the one that was here could never have run: this band is
    // drawn once by the server and the island only shows or hides the whole of it, so the
    // width never changes on a live page. It was `transition-[width] duration-300` — a
    // layout property, which the engine's own rule says bars must not take (the upload bars
    // scale, `media-images.ts`), at a fourth duration literal nothing else in the tree used.
    + `<span class="block h-full rounded-full bg-neutral-900 dark:bg-neutral-100" style="width:${(finished / flags.length) * 100}%"></span>`
    + `</span></span>`
  const steps5 = `<div data-first-run-progress="${finished}/${flags.length}"${done ? ' hidden' : ''}>`
    + band({
      title: escapeHtml(t.firstRunTitle),
      actions,
      body: `<p class="mb-4 text-sm text-neutral-600 dark:text-neutral-300">${escapeHtml(t.firstRunIntro)}</p>`
        + steps
        // The kit's own small button, not an underlined word: it closes the whole band, which is
        // an action, and a link-styled button beside five real links read as a sixth step.
        + `<div class="mt-5"><button type="button" data-first-run-dismiss class="${buttonClass('secondary', 'sm')}">`
        + `${escapeHtml(t.firstRunDismiss)}</button></div>`,
    })
    + `</div>`
  const reopen = `<p class="py-4"${done ? '' : ' hidden'}><button type="button" data-first-run-reopen`
    + ` class="${TAP} text-sm text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-white">`
    + `${escapeHtml(t.firstRunReopen)}</button></p>`
  // One stripe of the sheet, whichever of the two is showing.
  return `<div>${steps5}${reopen}</div>`
}

/**
 * The unfinished writing, handed back (ADR 0024 step 6), and FIRST since 2026-11-03: the page
 * opens on the piece you were writing, one row each, its whole title.
 *
 * Absent rather than empty when there is nothing: a band saying "no drafts" is furniture
 * reporting the absence of work. Four rows are enough to choose from and not enough to be a
 * list; past four the band SAYS there are more, because a cap nobody is told about reads as
 * "this is all of it". They were chips, which cut a headline to 115px on a phone so a 135px
 * timestamp could stand beside it.
 */
function pickUp(t: AdminStrings, lang: SiteLang, tz: string, list: { items: { title: string; href: string; touched: string; untitledNo?: number }[]; total: number }): string {
  if (list.items.length === 0) return ''
  return band({
    title: escapeHtml(t.dashPickUp),
    actions: list.total > list.items.length
      ? `<a href="/admin/content" class="${VIEW_ALL}">${escapeHtml(t.recentViewAll)}</a>`
      : '',
    body: `<ul class="space-y-1">` + list.items.map((it) =>
      `<li><a href="${escapeAttr(it.href)}" class="-mx-2 flex items-baseline gap-3 rounded-lg px-2 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">`
      // The pen's edge on everything unfinished (`admin-design.md`, the work-in-progress dot).
      + `<span aria-hidden="true" class="h-[5px] w-[5px] shrink-0 rounded-full bg-[var(--pen-edge)]"></span>`
      + `<span class="min-w-0 flex-1 text-sm font-medium text-neutral-900 dark:text-neutral-100">${escapeHtml(it.title || `${t.untitled} #${it.untitledNo ?? 1}`)}</span>`
      + (it.touched ? `<span class="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">${escapeHtml(sinceStart(it.touched, Date.now(), lang) || siteDateTimeShort(it.touched, tz, lang))}</span>` : '')
      + `</a></li>`).join('') + `</ul>`,
  })
}

/**
 * The build, the runtime, and how long this process has been up.
 *
 * The version's dot is the first colour in the admin outside the highlighter — amber behind,
 * green current, and NOTHING when the answer is not known. The third state is the point rather
 * than decoration: "up to date" is a claim, makeable only from an answer received recently, and
 * green on an install that has never reached the internet is the one state a person acts on by
 * doing nothing.
 */
function systemLine(t: AdminStrings, settings: SiteSettings, d: Awaited<ReturnType<typeof dashboardView>>): string {
  const { system, update, version, commit } = d
  const behind = update.state === 'behind'
  const dot = update.state === 'unknown' ? ''
    : `<span aria-hidden="true" title="${escapeAttr(behind ? t.updateAvailable.replace('{v}', update.release.latest) : t.updateCurrent)}"`
      + ` class="mr-1.5 inline-block h-[6px] w-[6px] rounded-full align-middle ${behind ? 'bg-amber-500' : 'bg-emerald-500'}"></span>`
  // WHERE IT POINTS is the difference between a version number and something to act on.
  // ⚠️ The link goes to the PROJECT, not the commit: the SHA is here to be READ, and a
  // per-commit URL 404s the moment a SHA is stale or the deploy shipped from a rebased branch.
  const href = behind ? update.release.url
    : update.state === 'current' ? `${REPO}/releases/tag/v${version}`
      : `${REPO}/releases`
  const said = behind ? t.updateAvailable.replace('{v}', update.release.latest)
    : update.state === 'current' ? t.updateCurrent : ''
  const build = `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer"`
    + ` class="${TAP} ${META_ON_CANVAS} hover:text-neutral-900 dark:hover:text-white">${dot}`
    // The wordmark is brand art, so its weight is not on the type scale (`check:admin-kit` OFF_SCALE_OK).
    + `quire<span class="font-bold">INK</span> v${escapeHtml(version)}`
    + (commit ? `<span class="tabular-nums"> (${escapeHtml(commit.slice(0, 7))})</span>` : '')
    // The DOT alone said this, and only to somebody who knew amber meant behind: a colour is a
    // reminder, not a sentence.
    + (said ? `<span class="ml-1.5">· ${escapeHtml(said)}</span>` : '')
    + `</a>`
  const facts = [
    system.runtime,
    system.databaseVersion ? `SQLite ${system.databaseVersion}` : system.database,
    system.os,
    `${t.sysStartedPrefix} ${sinceStart(system.startedAt, Date.now(), settings.language)}`,
  ].filter(Boolean).join(' · ')
  // THE MACHINE IS IN THE TOOLTIP, since 2026-09-23. "Bun 1.3.14 · SQLite 3.54.0 · Darwin 27.2
  // (arm64)" at the foot of the first screen a blog owner sees read as a developer console; the
  // version and whether it is current are the two facts an owner acts on, and the rest is still
  // one hover away for whoever is helping them. A database that is DOWN still shows in words.
  return `<div class="flex flex-wrap items-center justify-between gap-3 px-1 ${META_ON_CANVAS}"><span title="${escapeAttr(facts)}">`
    + build
    + (system.dbReachable ? '' : `<span class="ml-1.5 font-medium text-[var(--ink-danger)]">· offline</span>`)
    + `</span>`
    + (system.siteHref ? `<a href="${escapeAttr(system.siteHref)}" target="_blank" rel="noopener noreferrer" class="${TAP} hover:text-neutral-900 dark:hover:text-white">${escapeHtml(t.viewSite)} ↗</a>` : '')
    + `</div>`
}

export async function dashboardScreen(settings: SiteSettings): Promise<string> {
  const t = adminT(settings.language)
  const d = await dashboardView()
  const lang = settings.language
  const tz = siteZone(settings.timezone)

  // THE UNFINISHED WRITING LEADS, then the first five minutes while they last, then one line of
  // traffic, then what needs attention and how the finished writing did. The counts of posts,
  // pages, comments, pictures and bytes are gone (2026-11-03): each screen they name says it.
  const stripes = pickUp(t, lang, tz, d.dashboard.pickUp)
    // Above the numbers on purpose: on a fresh install every number is zero, and a screen of
    // zeroes is the least useful thing a new owner can be shown first.
    + firstRun(t, d.firstRunDone, d.setup as unknown as Record<string, boolean>)
    + trafficCard(t, lang, d.dashboard.traffic)
    + widgets(t, lang, tz, d.dashboard, d.recent, d.activityEnabled)

  return `<div data-screen="dashboard">`
    + header(t, settings, d.author, d.lastPublishedAt)
    + sheet(`<div class="divide-y divide-neutral-200 px-5 sm:px-7 dark:divide-neutral-800">${stripes}</div>`)
    // The whole line has a switch (Settings → System → Dashboard): an owner who wants no brand
    // on the screen gets none. Settings still says when an update exists, so this hides no
    // warning.
    + (d.systemLine ? `<div class="mt-6">${systemLine(t, settings, d)}</div>` : '')
    + `</div>`
}
