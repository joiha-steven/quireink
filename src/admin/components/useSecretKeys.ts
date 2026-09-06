// A WRITE-TO-SET form for credentials the server will not read back.
//
// Three panels do this — comment integrations, Cloudflare purge, off-site backup — and all
// three had written it out: the same state, the same placeholder hint, the same POST, and
// the same loop that sends only the non-empty fields.
//
// That loop is the reason this is shared rather than merely shorter. A secret the server
// never returns cannot be shown in the field, so the field is always blank, so a blank field
// has to mean KEEP — anything else silently wipes a working key the first time the owner
// saves the panel to change something else. That rule now exists once.
import { useState } from 'react'
import type { ApiResponse } from '@/types'
import type { SaveResult } from './ConnectionCard'
import { useToast } from '@/admin/ui/Toast'
import { useAdminT } from './I18nProvider'

export function useSecretKeys<K extends Record<string, string>>(
  endpoint: string,
  empty: K,
  onSaved?: () => void,
) {
  const t = useAdminT()
  const { notify } = useToast()
  const [keys, setKeys] = useState<K>(empty)
  const [busy, setBusy] = useState(false)

  const set = (k: keyof K, v: string) => setKeys((p) => ({ ...p, [k]: v }))

  /** A placeholder saying the field already holds something, so blank means keep. */
  const ph = (configured: boolean, label: string) =>
    configured ? `${label} · ${t.commentsKeySet}` : label

  /** Run an action with the panel disabled while it is in flight. */
  async function withBusy(action: () => Promise<void>): Promise<void> {
    setBusy(true)
    try {
      await action()
    } finally {
      setBusy(false)
    }
  }

  /**
   * Store the non-empty fields and RETURN what happened, instead of throwing it at a toast.
   *
   * This is the shape `ConnectionCard` takes (ADR 0041): the card prints the provider's own
   * sentence under the fields and leaves it there, where a four-second toast in the corner
   * carried none of it — and "535 authentication failed" is a password while "ENOTFOUND" is
   * a hostname, so the sentence is usually the whole answer.
   */
  async function saveResult(): Promise<SaveResult> {
    setBusy(true)
    try {
      const body: Partial<K> = {}
      for (const k of Object.keys(keys) as (keyof K)[]) {
        if (keys[k].trim()) body[k] = keys[k].trim() as K[keyof K]
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as ApiResponse
      if (!json.success) return { ok: false, error: json.error }
      setKeys(empty)
      onSaved?.()
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : undefined }
    } finally {
      setBusy(false)
    }
  }

  const save = () =>
    withBusy(async () => {
      const res = await saveResult()
      notify(res.ok ? t.commentsKeySaved : t.deleteFailed, res.ok ? 'success' : 'error')
    })

  /** Whether any field has been typed into — what a card's lamp reads as "not stored yet". */
  const touched = Object.values(keys).some((v) => v.trim().length > 0)

  return { keys, busy, touched, set, ph, save, saveResult, withBusy, notify }
}
