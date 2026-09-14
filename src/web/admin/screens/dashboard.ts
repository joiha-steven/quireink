// The admin's front door, as HTML the server sends (ADR 0054).
//
// THE HIGHEST-VALUE CONVERSION IN THE SET, and not because it is the heaviest: it is the screen
// every visit starts on. 1,276 lines of React across seven files, of which exactly one held any
// state at all, and all of it waited for a bundle, a route chunk and a data fetch before a word
// appeared. A screen that is almost pure reading had the longest wait in the admin.
//
// ⚠️ ONE FACT ON THIS PAGE THE SERVER CANNOT KNOW: what time it is where the reader is sitting.
// The greeting reads the BROWSER's clock on purpose — a site in Asia/Bangkok read by its owner
// in Berlin should say good evening when it is evening where the eyes are — so all four
// greetings are drawn and `data-daypart`, stamped by the boot script before the first paint,
// decides which one shows. The rail's Mac chord works the same way for the same reason.
import type { SiteSettings } from '@/types'
import type { AdminStrings } from '@/i18n/admin-i18n'
import { adminT } from '@/i18n/admin-i18n'
import { escapeAttr, escapeHtml, formatBytes, formatDateTimeShort } from '@/utils'
import { buttonClass } from '@/admin-shared/kit'
import { CARD_GAP, META_ON_CANVAS, SECTION_GAP, TAP, TITLE } from '@/admin-shared/scale'
import { DAY_PARTS, dayPartName, relativeDay, sinceStart } from '@/admin-shared/when'
import { firstRunSteps } from '@/admin-shared/first-run'

import { REPO } from '@/admin-shared/help'
import { icon } from '@/web/admin/kit'
import { card, statBand, statCard } from '@/web/admin/kit-figures'
import { trafficCard, widgets } from '@/web/admin/screens/dashboard-cards'
import { dashboardView } from '@/web/admin/views-home'

/**
 * The two links the greeting owns, by the `?setting=` route ADR 0041 kept working: straight to
 * the card that holds the portrait, and to the tab that holds the name. Written here rather
 * than taken from `first-run.ts`, whose five are a different list about a different job.
 */
const PORTRAIT_HREF = '/admin/settings?tab=blog&setting=authorAvatar'
const NAME_HREF = '/admin/settings?tab=blog'

const RING = 'h-11 w-11 shrink-0 rounded-full border border-neutral-200 dark:border-neutral-700'
const CHIP = buttonClass('secondary', 'md', 'max-w-full font-normal text-neutral-700 dark:text-neutral-200')
const VIEW_ALL = 'text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'

/**
 * The portrait, or an INVITATION to set one.
 *
 * The picture stays `aria-hidden`, because the name is written beside it in text: a screen
 * reader that reads a portrait AND the name says the name twice. The empty circle is NOT
 * hidden, deliberately — an empty slot that can be filled should say so and be the way to fill
 * it, and on a blog that has a name but no picture it was the one state with no way out.
 */
function portrait(t: AdminStrings, author: { name: string; avatarUrl: string }): string {
  if (author.avatarUrl) {
    return `<img src="${escapeAttr(author.avatarUrl)}" alt="" aria-hidden="true" class="${RING} object-cover">`
  }
  const initials = author.name.split(/\s+/).filter(Boolean).slice(0, 2)
    .map((word) => [...word][0] ?? '').join('').toUpperCase()
  const inside = initials
    ? escapeHtml(initials)
    : icon('person', 'h-5 w-5')
  return `<a href="${escapeAttr(PORTRAIT_HREF)}" aria-label="${escapeAttr(t.greetAddPortrait)}"`
    + ` title="${escapeAttr(t.greetAddPortrait)}"`
    + ` class="${RING} grid place-items-center bg-neutral-100 text-sm font-medium text-neutral-500 transition-colors hover:border-neutral-400 hover:text-neutral-900 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:border-neutral-500 dark:hover:text-white">`
    + `${inside}</a>`
}

/**
 * The first line: whose desk this is. It REPLACES the page title rather than sitting above one.
 *
 * ALL FOUR GREETINGS ARE HERE and CSS shows the one `data-daypart` names. The pattern carries
 * the punctuation, so a language that puts no comma between the greeting and the name does not
 * get one.
 */
function greeting(t: AdminStrings, settings: SiteSettings, author: { name: string; avatarUrl: string }, lastPublishedAt: string | null): string {
  const named = author.name.trim()
  const lines = DAY_PARTS.map((part) => {
    const hello = t[part]
    const said = named ? t.greetWithName.replace('{greeting}', hello).replace('{name}', named) : hello
    return `<span data-greet="${dayPartName(part)}">${escapeHtml(said)}</span>`
  }).join('')
  const when = lastPublishedAt
    ? `${t.greetLastPublished} ${relativeDay(t.greetToday, lastPublishedAt, Date.now(), settings.language)}`
    : t.greetNothingYet
  return `<div class="mb-10 flex flex-wrap items-center justify-between gap-4">`
    + `<div class="flex min-w-0 items-center gap-3">${portrait(t, author)}`
    + `<div class="min-w-0"><h1 class="truncate ${TITLE}">${lines}</h1>`
    + `<p class="${META_ON_CANVAS} mt-0.5">${escapeHtml(when)}`
    + (named ? '' : ` · <a href="${escapeAttr(NAME_HREF)}" class="underline underline-offset-2 hover:text-neutral-900 dark:hover:text-white">${escapeHtml(t.greetSetName)}</a>`)
    + `</p></div></div>`
    + `<div class="flex items-center gap-3"><a href="/admin/editor" class="${buttonClass()}">${escapeHtml(t.newPost)}</a></div>`
    + `</div>`
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
  const steps = `<ol class="grid gap-x-6 gap-y-4 sm:grid-cols-2">`
    + firstRunSteps(t).map((s, i) => `<li class="flex gap-3">`
      + (flags[i]
        // A DONE step trades its number for a tick and takes the pen: the number was the thing
        // to do next, and a finished step is no longer one.
        ? `<span aria-hidden="true" data-step-done class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--pen)] text-xs font-bold text-neutral-950">✓</span>`
        : `<span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-xs font-medium tabular-nums text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">${i + 1}</span>`)
      + `<div class="min-w-0"><a href="${escapeAttr(s.href)}" class="text-sm font-medium underline-offset-2 hover:underline ${flags[i] ? 'text-neutral-500 dark:text-neutral-400' : 'text-neutral-900 dark:text-neutral-100'}">${escapeHtml(s.label)}</a>`
      + `<p class="mt-0.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">${escapeHtml(s.body)}</p></div></li>`).join('')
    + `</ol>`
  // THE COUNT IS THE HEADLINE, on the card's own title row where a state belongs: it is what
  // turns five links into a path with a position on it. The bar carries no number of its own —
  // the same fact in a shape the eye reads without counting — so it is `aria-hidden`.
  const actions = `<span class="flex items-center gap-2.5">`
    + `<span class="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">`
    + `${escapeHtml(t.firstRunProgress.replace('{done}', String(finished)).replace('{total}', String(flags.length)))}</span>`
    + `<span aria-hidden="true" class="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">`
    + `<span class="block h-full rounded-full bg-[var(--pen-edge)] transition-[width] duration-300" style="width:${(finished / flags.length) * 100}%"></span>`
    + `</span></span>`
  const band = `<div data-first-run-progress="${finished}/${flags.length}"${done ? ' hidden' : ''}>`
    + card({
      title: escapeHtml(t.firstRunTitle),
      actions,
      body: `<p class="mb-4 text-sm text-neutral-600 dark:text-neutral-300">${escapeHtml(t.firstRunIntro)}</p>`
        + steps
        + `<div class="mt-5"><button type="button" data-first-run-dismiss class="${TAP} text-sm font-medium text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-white">`
        + `${escapeHtml(t.firstRunDismiss)}</button></div>`,
    })
    + `</div>`
  const reopen = `<p class="mb-5"${done ? '' : ' hidden'}><button type="button" data-first-run-reopen`
    + ` class="text-sm text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-white">`
    + `${escapeHtml(t.firstRunReopen)}</button></p>`
  return band + reopen
}

/**
 * The unfinished writing, handed back (ADR 0024 step 6).
 *
 * Absent rather than empty when there is nothing: a card saying "no drafts" is a row of
 * furniture reporting the absence of work. Four chips are enough to choose from and not enough
 * to be a list; past four the band SAYS there are more, because a cap nobody is told about
 * reads as "this is all of it".
 */
function pickUp(t: AdminStrings, band: { items: { title: string; href: string; touched: string; untitledNo?: number }[]; total: number }): string {
  if (band.items.length === 0) return ''
  return card({
    title: escapeHtml(t.dashPickUp),
    actions: band.total > band.items.length
      ? `<a href="/admin/content" class="${VIEW_ALL}">${escapeHtml(t.recentViewAll)}</a>`
      : '',
    body: `<div class="flex flex-wrap gap-2">` + band.items.map((it) =>
      `<a href="${escapeAttr(it.href)}" class="${CHIP}">`
      // The mock's chip dot: the pen's edge on everything unfinished.
      + `<span aria-hidden="true" class="h-[5px] w-[5px] shrink-0 rounded-full bg-[var(--pen-edge)]"></span>`
      // `truncate` on the TITLE only, so a long headline shortens and the timestamp beside it
      // is never pushed out of the chip.
      + `<span class="truncate">${escapeHtml(it.title || `${t.untitled} #${it.untitledNo ?? 1}`)}</span>`
      + (it.touched ? `<span class="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">${escapeHtml(formatDateTimeShort(it.touched))}</span>` : '')
      + `</a>`).join('') + `</div>`,
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
    + ` class="${META_ON_CANVAS} hover:text-neutral-900 dark:hover:text-white">${dot}`
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
  return `<div class="flex flex-wrap items-center justify-between gap-3 px-1 ${META_ON_CANVAS}"><span>`
    // Desktop-only at rest — on a phone the four facts after it are what somebody is standing
    // there for — but an install that is BEHIND shows at every width.
    + `<span class="${behind ? 'inline' : 'hidden sm:inline'}">${build} · </span>`
    + `${escapeHtml(facts)}`
    + (system.dbReachable ? '' : `<span class="ml-1.5 font-medium text-[var(--pen-red)]">· offline</span>`)
    + `</span>`
    + (system.siteHref ? `<a href="${escapeAttr(system.siteHref)}" target="_blank" rel="noopener noreferrer" class="hover:text-neutral-900 dark:hover:text-white">${escapeHtml(t.viewSite)} ↗</a>` : '')
    + `</div>`
}

export async function dashboardScreen(settings: SiteSettings): Promise<string> {
  const t = adminT(settings.language)
  const d = await dashboardView()
  const lang = settings.language

  // THE NUMBER STRIP LEADS, then the unfinished writing, then what needs attention, then how
  // the finished writing did, and the administration counts last — they used to lead
  // (ADR 0024 step 6).
  const body = greeting(t, settings, d.author, d.lastPublishedAt)
    // Above the numbers on purpose: on a fresh install every number is zero, and a screen of
    // zeroes is the least useful thing a new owner can be shown first.
    + firstRun(t, d.firstRunDone, d.setup as unknown as Record<string, boolean>)
    + trafficCard(t, lang, d.dashboard.traffic)
    + pickUp(t, d.dashboard.pickUp)
    + `<div class="grid ${CARD_GAP} lg:grid-cols-2">${widgets(t, lang, d.dashboard, d.recent, d.activityEnabled)}</div>`
    + statBand(
      statCard({ bare: true, label: t.statPosts, value: String(d.posts), href: '/admin/content' })
      + statCard({ bare: true, label: t.statPages, value: String(d.pages), href: '/admin/content' })
      + statCard({ bare: true, label: t.statComments, value: String(d.comments), href: '/admin/comments' })
      + statCard({ bare: true, label: t.statMedia, value: String(d.originals), href: '/admin/media' })
      + statCard({ bare: true, label: t.statStorage, value: formatBytes(d.totalBytes) }),
    )
    // The whole line has a switch (Settings → System → Dashboard): an owner who wants no brand
    // on the screen gets none. Settings still says when an update exists, so this hides no
    // warning.
    + (d.systemLine ? systemLine(t, settings, d) : '')

  return `<div data-screen="dashboard"><div class="${SECTION_GAP}">${body}</div></div>`
}
