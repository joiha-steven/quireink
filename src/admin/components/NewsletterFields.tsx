// Admin SMTP panel (Settings → Integrations): credentials only. The subscriber list,
// the manual send and the test sends live on Admin → Newsletter — this card is the
// plumbing, that page is the work. Reads GET /api/mail, saves via POST /api/mail.
// Independent of the settings Save bar.
import { useEffect, useState } from 'react'
import Link from '@/admin/router'
import type { ApiResponse } from '@/types'
import { Input } from '@/admin/ui/Input'
import { CheckField } from '@/admin/ui/Switch'
import { useAdminT } from './I18nProvider'
import { ConnectionCard, type SaveResult } from './ConnectionCard'
import { NOTE_TEXT } from './kit'

type MailStatus = { host: string; port: number; user: string; from: string; secure: boolean; hasPass: boolean; configured: boolean }

// Implicit TLS is a port-465 thing; 587 (and 25) speak STARTTLS and must be sent in the
// clear first. Getting this pair wrong fails with an opaque OpenSSL "wrong version
// number", so the port drives the checkbox instead of leaving them to drift apart.
const secureForPort = (port: number) => port === 465

/**
 * SMTP, as a card that saves and then actually sends (ADR 0041).
 *
 * Storing a host proves nothing about whether mail leaves the machine, and "why did my
 * newsletter not send" was the question this card could not answer: it had a Save button, a
 * success toast, and no way to find out that port 587 was blocked or the password was stale.
 * `POST /api/mail/test` sends one real message to the owner's own address, so the answer
 * arrives in their inbox and the provider's refusal arrives under the card.
 */
export function NewsletterCard() {
  const t = useAdminT()
  const [cfg, setCfg] = useState<MailStatus | null>(null)
  const [pass, setPass] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    fetch('/api/mail')
      .then((r) => r.json() as Promise<ApiResponse<MailStatus>>)
      // NARROWED, not merely truthy. `j.data` is whatever came off the wire, and the card
      // reads `cfg.host.trim()` in five places — so anything that is not the shape this card
      // knows has to leave it in its loading state rather than throw the whole tab away
      // three renders later, where the stack names React and not this line.
      .then((j) => { if (j.success && typeof j.data?.host === 'string') setCfg(j.data) })
      .catch(() => {})
  }, [])

  function field<K extends keyof MailStatus>(k: K, v: MailStatus[K]) {
    setDirty(true)
    setCfg((c) => (c ? { ...c, [k]: v } : c))
  }

  function setPort(port: number) {
    setDirty(true)
    setCfg((c) => (c ? { ...c, port, secure: secureForPort(port) } : c))
  }

  async function saveAndTest(): Promise<SaveResult> {
    if (!cfg) return { ok: false }
    try {
      const body: Record<string, unknown> = { host: cfg.host, port: cfg.port, user: cfg.user, from: cfg.from, secure: cfg.secure }
      if (pass) body.pass = pass
      const res = await fetch('/api/mail', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const j = (await res.json()) as ApiResponse<unknown>
      if (!j.success) return { ok: false, error: j.error }
      setPass('')
      setDirty(false)
      // Nothing to try against an empty host — an install with no mail is not broken, it is
      // a blog with no newsletter, and lighting the lamp red for it would be a lie.
      if (!cfg.host.trim()) return { ok: true }
      const sent = await fetch('/api/mail/test', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'smtp' }),
      })
      const st = (await sent.json()) as ApiResponse<unknown>
      // The transport's own sentence: "535 authentication failed" is a password and
      // "ENOTFOUND" is a hostname, and neither survives being renamed "Save failed".
      return st.success ? { ok: true, tested: true } : { ok: false, error: st.success ? undefined : st.error }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : undefined }
    }
  }

  if (!cfg) return <p className="text-sm text-neutral-500 dark:text-neutral-400">{t.loading}</p>

  const mismatch = cfg.secure !== secureForPort(cfg.port)

  return (
    <ConnectionCard
      title={t.cardNewsletter}
      enabled={Boolean(cfg.host.trim())}
      connected={cfg.configured}
      dirty={dirty || pass.length > 0}
      canTest={Boolean(cfg.host.trim())}
      onSave={saveAndTest}
    >
    <div className="space-y-5">
      <p className={NOTE_TEXT}>{t.nlSmtpHint}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label={t.nlSmtpHost} value={cfg.host} onChange={(e) => field('host', e.target.value)} placeholder="smtp.example.com" />
        <Input label={t.nlSmtpPort} type="number" value={String(cfg.port)} onChange={(e) => setPort(Number(e.target.value) || 587)} />
        <Input label={t.nlSmtpUser} value={cfg.user} onChange={(e) => field('user', e.target.value)} autoComplete="off" />
        <Input label={t.nlSmtpPass} type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder={cfg.hasPass ? '••••••••' : ''} autoComplete="new-password" />
        <Input label={t.nlSmtpFrom} value={cfg.from} onChange={(e) => field('from', e.target.value)} placeholder="Blog <hi@example.com>" />
      </div>
      {/* Was a browser-default checkbox, which read as a different application from the
          switches on every other card. `CheckField` is the shared one. */}
      <CheckField label={t.nlSmtpSecure} checked={cfg.secure} onChange={(v) => field('secure', v)} />
      {mismatch && <p className={NOTE_TEXT}>{t.nlSmtpTlsMismatch}</p>}
      <Link href="/admin/newsletter" className="text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">
        {t.nlManageLink} →
      </Link>
    </div>
    </ConnectionCard>
  )
}
