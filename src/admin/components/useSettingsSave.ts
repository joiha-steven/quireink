// What the settings form knows about its own unsaved state: how much of it there is, how to
// store it, and what to ask when somebody tries to walk away from it.
//
// Split out of `SettingsView` rather than written there, and the reason is the seam and not
// the line count. That file's job is which card renders on which tab; this one's is a
// question about the WHOLE form that no tab has an opinion about. Keeping them together made
// the tab list and the save protocol change in the same file for unrelated reasons.
import { useMemo, useState } from 'react'
import { useNavigationGuard, useRouter } from '@/admin/router'
import type { SiteSettings, ApiResponse } from '@/types'
import { useToast } from '@/admin/ui/Toast'
import { useConfirm } from '@/admin/ui/ConfirmDialog'
import { useAdminT } from './I18nProvider'

export type SettingsSave = {
  /** How many top-level keys differ from what the server last handed us. */
  changed: number
  saving: boolean
  /** ISO time of the last successful save, or null. */
  savedAt: string | null
  /** Stores the form. Resolves to whether it worked. */
  save: () => Promise<boolean>
}

/**
 * @param settings what the server last gave us — the baseline the count is measured against
 * @param s the form's current value
 */
export function useSettingsSave(settings: SiteSettings, s: SiteSettings): SettingsSave {
  const t = useAdminT()
  const router = useRouter()
  const { notify } = useToast()
  const ask = useConfirm()
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  /**
   * A COUNT rather than a boolean, because the count is what makes the Save key worth
   * pressing: a button reading "Save settings" says only that saving exists, and one reading
   * "Save · 3 changes" says there is work on this screen that is not stored yet. It is also
   * the number the leave dialog quotes, so both come from one place.
   *
   * Compared by SERIALISATION, one key at a time. `SiteSettings` is a tree of plain JSON — it
   * arrives as JSON and is PUT as JSON — so its values have no identity worth preserving and
   * no cycles to trip on, and a per-key compare gives the count for free where a whole-object
   * compare would only give a boolean. Key order cannot drift between the two sides because
   * the form starts as a copy of `settings` and is only ever spread over.
   */
  const changed = useMemo(() => {
    const keys = new Set([...Object.keys(settings), ...Object.keys(s)]) as Set<keyof SiteSettings>
    let n = 0
    for (const k of keys) if (JSON.stringify(s[k]) !== JSON.stringify(settings[k])) n++
    return n
  }, [s, settings])

  async function save(): Promise<boolean> {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      })
      const json = (await res.json()) as ApiResponse<SiteSettings>
      if (!json.success) throw new Error(json.error)
      setSavedAt(new Date().toISOString())
      notify(t.savedSettings)
      // Refetch the shell so a language change reaches the whole admin at once. It is also
      // what clears the count: the shell hands the view a new `settings` prop, and `changed`
      // is measured against that rather than against a flag we could forget to lower.
      router.refresh()
      return true
    } catch {
      notify(t.saveFailed, 'error')
      return false
    } finally {
      setSaving(false)
    }
  }

  /**
   * Leaving with work on the screen asks a THREE-way question, because there are three
   * answers: keep it, throw it away, or go back to it. A yes/no dialog answers it by throwing
   * one of the three away, and the one it usually throws away is "save" — which is what the
   * reader wanted in the first place.
   *
   * ⚠️ Save-and-go returns whether the save SUCCEEDED. Letting the navigation through on a
   * failed save is how a form is lost by the button that promised to keep it, so a refused
   * save leaves the reader on the page with the error toast still up.
   */
  useNavigationGuard(changed > 0, async () => {
    const answer = await ask({
      title: t.leaveUnsavedTitle.replace('{n}', String(changed)),
      body: t.leaveUnsavedBody,
      altLabel: t.leaveUnsavedSave,
      confirmLabel: t.leaveUnsavedDiscard,
      cancelLabel: t.leaveUnsavedStay,
      danger: true,
    })
    if (answer === 'alt') return await save()
    return answer === 'confirm'
  })

  return { changed, saving, savedAt, save }
}
