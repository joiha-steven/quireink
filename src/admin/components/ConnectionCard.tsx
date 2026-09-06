// A settings card that owns its own keys: it saves itself, it says whether the far end
// answered, and it prints the refusal where the fields are.
//
// ADR 0041. Nine cards on the old settings screen already saved through their own endpoint —
// redirects, Cloudflare, the S3 copy, MCP, security, the import, the cache, the export, SMTP
// — while every other key on the same screen waited for the sheet's one Save button. A tab
// therefore showed two ways to save at once with nothing saying which button owned which box,
// and a screen that answers "did that save?" with "it depends which box you were in" has to be
// read rather than used. Tabs 5-7 are now made entirely of these; the sheet's Save renders on
// tabs 1-4 only.
//
// TWO THINGS BEYOND SAVING, and they are the reason this is a component rather than a
// convention:
//
//   · IT TESTS. Storing an SMTP host proves nothing about whether mail leaves the machine. A
//     card whose far end can be reached says "Save and test" and reaches it; one whose cannot
//     — MCP mints a token, redirects write a table — says "Save". The label is derived from
//     whether `onSave` reports a test, never typed per call site.
//   · THE ERROR STAYS. A refused key used to arrive as `notify(t.saveFailed)`: a four-second
//     toast, in the corner, carrying none of what the provider said. The remote sentence is
//     printed under the card in the admin's alert ink and stays there until the next attempt,
//     because the sentence is usually the whole answer ("535 authentication failed" is a
//     password, "ENOTFOUND" is a hostname).
import { useState, type ReactNode } from 'react'
import { Button } from '@/admin/ui/Button'
import { Lamp, type LampState } from '@/admin/ui/Lamp'
import { NOTE_ALERT } from './scale'
import { SettingsCard } from './SettingsCard'
import { useAdminT } from './I18nProvider'

/**
 * What one attempt came back with.
 *
 * `tested` is what decides the button's label on the NEXT render, so a card learns whether
 * its far end is reachable from the answer rather than from a flag somebody set by hand.
 */
export type SaveResult = { ok: boolean; error?: string; tested?: boolean }

export function ConnectionCard({
  title,
  /** True when the card holds edits that are not stored. Drives the lamp and the button. */
  dirty = false,
  /** Whether the thing this card configures is switched on at all. */
  enabled = true,
  /** Whether it is known to be working — configured, and the last test passed. */
  connected = false,
  /** Named so the card can say "Save" when there is nothing at the other end to try. */
  canTest = false,
  onSave,
  children,
  actions,
}: {
  title: ReactNode
  dirty?: boolean
  enabled?: boolean
  connected?: boolean
  canTest?: boolean
  onSave: () => Promise<SaveResult>
  children: ReactNode
  actions?: ReactNode
}) {
  const t = useAdminT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passed, setPassed] = useState(false)

  /**
   * ⚠️ AMBER BEATS GREEN, and the order is the decision.
   *
   * A card with unstored edits reads amber even when the stored configuration is perfectly
   * good, because what the lamp answers is "is what I am looking at live?" — and it is not.
   * Green under an edited form is the reassurance that hides the unsaved change.
   */
  const state: LampState = error ? 'attention'
    : dirty ? 'attention'
    : !enabled ? 'off'
    : (connected || passed) ? 'good'
    : 'attention'

  const lampTitle = error ? t.connectionFailed
    : dirty ? t.connectionUnsaved
    : !enabled ? t.connectionOff
    : (connected || passed) ? t.connectionOk
    : t.connectionUntested

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const res = await onSave()
      setPassed(res.ok && res.tested === true)
      // An empty string is still a failure with nothing to say, so fall back to the generic
      // line rather than printing nothing and leaving the lamp red for no visible reason.
      setError(res.ok ? null : (res.error?.trim() || t.saveFailed))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsCard
      title={title}
      // In the DOT's place, never beside it: the mark that opens a card's title row is one
      // mark. `SettingsCard` says what happened when this was two.
      lamp={<Lamp state={state} title={lampTitle} />}
      actions={actions}
    >
      {children}
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-4 dark:border-neutral-800">
        <Button size="sm" onClick={() => { void run() }} disabled={busy}>
          {busy ? t.saving : canTest ? t.saveAndTest : t.save}
        </Button>
      </div>
      {/* Under the card, in the alert ink, and it STAYS. `NOTE_ALERT` is the one note style
          `[data-explanations=off]` does not hide, which is exactly right here: the reason
          something is broken is not an explanation somebody chose to switch off. */}
      {error && <p className={`${NOTE_ALERT} mt-2`}>{error}</p>}
    </SettingsCard>
  )
}
