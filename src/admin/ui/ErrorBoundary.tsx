// The net under the admin.
//
// It is here because of what happened without it. A post containing `**đậm** và ==mực==`
// made markdown-it throw while the editor was parsing it; the throw came up through
// `setContent` into a React render, React found no boundary above it, and did the only thing
// it can do in that case — unmounted the whole tree. The owner opened a draft and got a white
// page: no message, no sidebar, no way back except typing a different URL. The bug was one
// line of parser plumbing (`components/markdown-nested.ts`), but the BLANK SCREEN was this
// file being absent, and the next parser bug would have produced exactly the same nothing.
//
// So: one page may fail, and the failure has to be a sentence the owner can read and act on.
//
// WHERE IT SITS is the whole design. Inside the canvas, around the routed page, and OUTSIDE
// the sidebar — the rail keeps working, so a screen that dies is a screen you can navigate
// away from. `App.tsx` keys it by pathname, which makes leaving the broken page reset it
// without a reload: a boundary that stays tripped after you have gone somewhere else is a
// second way to be stuck.
//
// WHAT IT DOES NOT DO: retry in place. React does not re-run the failed render on its own,
// and a "try again" that re-renders the same broken state is a button that does nothing
// twice. The two honest offers are reload this page, or go somewhere else — and both are here.
// NOT COVERED BY A RENDERING TEST, and the reason is worth writing down rather than
// rediscovering: `src/admin` is excluded from the ROOT tsconfig, whose `jsxImportSource` is
// hono/jsx for server-rendered markup, and `bun test` transpiles by that root config. Any
// admin component RENDERED under the test runner therefore builds hono elements and React
// rejects them ("Invalid JSX tag name"). Every admin component shares that latent split and
// gets away with it by only ever running in the browser bundle. So this one is proved the way
// the repo proves rendered things: `error-boundary.test.ts` holds the wiring and the state
// transition, and the sheet itself was tripped on purpose in a real browser and looked at.
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/admin/ui/Button'
import { CARD, NOTE_TEXT, TITLE } from '@/admin/components/kit'
import { useAdminT } from '@/admin/components/I18nProvider'
import { isStaleChunk } from '@/admin/ui/stale-build'

/** What is worth showing about a thrown value. Anything can be thrown, so nothing is assumed. */
function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message || error.name
  return String(error)
}

/**
 * The sheet the owner actually reads.
 *
 * A function component, not markup inside the class, because the strings come from
 * `useAdminT` and a class cannot call a hook. It renders inside the same provider the rest of
 * the admin does, so it speaks the site's language like every other screen.
 *
 * The error's own message is shown, in monospace, under a label. This is an owner-only tool
 * behind the same gate as every write route, so there is no one to leak it to — and without
 * it a bug report is "it went blank", which is where this whole file started.
 */
function CrashSheet({ error }: { error: unknown }) {
  const t = useAdminT()
  // TWO SHEETS, one layout. A render that threw and a file that never arrived look identical
  // from here — both land as a caught value — but they are not the same event and the owner
  // is owed the right sentence. `crashText` says the page "failed while it was drawing",
  // which is a lie about a page that never drew, and it promises the sidebar still works,
  // which is no comfort when the cause is that the whole build moved on underneath the tab.
  //
  // Reaching this sheet at all with a missing chunk means `throughDeploys` already reloaded
  // once and it did not help, so the honest reading is no longer "your tab is old" but "the
  // file is not there, or you are offline". The text says both, because from the browser the
  // two are indistinguishable.
  const missing = isStaleChunk(error)
  return (
    <div className={`${CARD} p-6 sm:p-8`}>
      <h1 className={TITLE}>{missing ? t.crashMissingTitle : t.crashTitle}</h1>
      <p className={`${NOTE_TEXT} mt-3 max-w-prose`}>{missing ? t.crashMissingText : t.crashText}</p>
      <p className={`${NOTE_TEXT} mt-4`}>
        {t.crashDetail}
        {': '}
        <span className="font-mono text-neutral-700 dark:text-neutral-300">{messageOf(error)}</span>
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="primary" onClick={() => location.reload()}>
          {t.crashReload}
        </Button>
        <Button variant="secondary" onClick={() => { location.href = '/admin' }}>
          {t.crashHome}
        </Button>
      </div>
    </div>
  )
}

type Props = { children: ReactNode }
type State = { error: unknown }

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error }
  }

  /**
   * The console line is not decoration either. React swallows the error once a boundary
   * handles it, and the componentStack is the only thing that says WHICH page died — which
   * is what the owner will be asked for when they report this.
   */
  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('admin: a page failed to render', error, info.componentStack)
  }

  override render(): ReactNode {
    if (this.state.error !== null) return <CrashSheet error={this.state.error} />
    return this.props.children
  }
}
