// The home screen's first line: whose desk this is.
//
// The Overview opened with the word "Overview" — a category name, over six blocks of numbers
// about the AUDIENCE: traffic, referrers, countries, most viewed. Correct, useful, and it
// could have been anybody's blog. A writing tool's home screen should look like it belongs to
// the person who writes it, and this is the one row on the page that says so.
//
// THE NAME AND PORTRAIT ARE THE ONES THAT ALREADY EXIST. `settings.author` has held
// `name`, `bio`, `avatarUrl` and `url` since the author box shipped; a second pair for the
// admin would be a second thing to keep in step with the first, and a blog has one owner
// (ADR 0002). Empty is a real answer and not a gap to paper over: an install with no author
// set is silent on the public side by design, so here it ASKS rather than inventing a name.
//
// The greeting reads the BROWSER's clock, not the site's timezone. A site in Asia/Bangkok
// read by its owner in Berlin should say good evening when it is evening where the eyes are;
// the site timezone is for the reader's dateline, which is a different question.
import Link from '@/admin/router'
import { META_ON_CANVAS } from './scale'
import { useAdminT } from './I18nProvider'

export type GreetingAuthor = { name: string; avatarUrl: string }

/** Morning / afternoon / evening / night, on the four boundaries most languages agree on. */
export function partOfDay(hour: number): 'greetMorning' | 'greetAfternoon' | 'greetEvening' | 'greetNight' {
  if (hour < 5) return 'greetNight'
  if (hour < 12) return 'greetMorning'
  if (hour < 18) return 'greetAfternoon'
  if (hour < 22) return 'greetEvening'
  return 'greetNight'
}

/**
 * The portrait, or the initials standing in for one.
 *
 * `aria-hidden`, because the name is written beside it in text: a screen reader that reads a
 * portrait AND the name says the name twice. With no name at all there are no initials to
 * draw either, and the circle is a quiet placeholder rather than a letter chosen at random.
 */
function Portrait({ author }: { author: GreetingAuthor }) {
  const initials = author.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => [...word][0] ?? '')
    .join('')
    .toUpperCase()
  const ring = 'h-11 w-11 shrink-0 rounded-full border border-neutral-200 dark:border-neutral-700'
  if (author.avatarUrl) {
    return <img src={author.avatarUrl} alt="" aria-hidden className={`${ring} object-cover`} />
  }
  return (
    <span
      aria-hidden
      className={`${ring} grid place-items-center bg-neutral-100 text-sm font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400`}
    >
      {initials}
    </span>
  )
}

/**
 * @param lastPublishedAt ISO of the newest published piece, or null on a blog with none.
 * @param now Injected so the test can stand at a fixed hour; the screen passes nothing.
 */
export function Greeting({ author, lastPublishedAt, actions, now = new Date() }: {
  author: GreetingAuthor
  lastPublishedAt: string | null
  actions?: React.ReactNode
  now?: Date
}) {
  const t = useAdminT()
  const hello = t[partOfDay(now.getHours())]
  const named = author.name.trim()
  // The pattern carries the punctuation, so a language that does not put a comma between the
  // greeting and the name does not get one. Two-step rather than one string per part of day
  // per naming case, which would be eight rows in eleven dictionaries.
  const line = named ? t.greetWithName.replace('{greeting}', hello).replace('{name}', named) : hello

  return (
    // `mb-10` matches `PageHeader`, which this replaces on the home screen. Same rhythm as
    // every other page, so the home does not sit at its own spacing.
    <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <Portrait author={author} />
        <div className="min-w-0">
          <h1 className="truncate text-[1.375rem] font-semibold tracking-[-0.01em] text-neutral-900 dark:text-white">
            {line}
          </h1>
          <p className={`${META_ON_CANVAS} mt-0.5`}>
            {/* The one fact here about the owner's OWN writing. Everything else on this page
                is about the audience, and a greeting is not the place to start counting
                strangers. */}
            {lastPublishedAt ? `${t.greetLastPublished} ${relative(t, lastPublishedAt, now)}` : t.greetNothingYet}
            {!named && (
              <>
                {' · '}
                <Link href="/admin/settings?tab=site" className="underline underline-offset-2 hover:text-neutral-900 dark:hover:text-white">
                  {t.greetSetName}
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  )
}

/**
 * "today" / "3 days ago" / "in March" — the resolution a person actually thinks in.
 *
 * `Intl.RelativeTimeFormat` rather than a hand-rolled table, because it is the one part of
 * this that eleven languages disagree about in ways nobody here can enumerate: Vietnamese
 * puts the marker first, Russian picks a plural form by the last digit, Japanese uses neither.
 */
export function relative(t: { greetToday: string }, iso: string, now: Date): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  const days = Math.round((then.getTime() - now.getTime()) / 86_400_000)
  if (days === 0) return t.greetToday
  const lang = typeof document !== 'undefined' ? document.documentElement.lang || 'en' : 'en'
  try {
    const fmt = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
    if (Math.abs(days) < 30) return fmt.format(days, 'day')
    if (Math.abs(days) < 365) return fmt.format(Math.round(days / 30), 'month')
    return fmt.format(Math.round(days / 365), 'year')
  } catch {
    // An unknown tag, which `Intl` throws on rather than falling back. The date itself is
    // still true, and a date is a better answer than an empty line.
    return then.toLocaleDateString()
  }
}
