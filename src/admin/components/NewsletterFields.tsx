// Admin SMTP panel (Settings → Integrations): credentials only. The subscriber list,
// the manual send and the test sends live on Admin → Newsletter — this card is the
// plumbing, that page is the work. Reads GET /api/mail, saves via POST /api/mail.
// Independent of the settings Save bar.
import { useEffect, useState } from 'react'
import Link from '@/admin/router'
import type { ApiResponse } from '@/types'
import { Input } from '@/admin/ui/Input'
import { Button } from '@/admin/ui/Button'
import { CheckField } from '@/admin/ui/Switch'
import { useToast } from '@/admin/ui/Toast'
import { useAdminT } from './I18nProvider'
import { NOTE_TEXT } from './kit'

type MailStatus = { host: string; port: number; user: string; from: string; secure: boolean; hasPass: boolean; configured: boolean }

// Implicit TLS is a port-465 thing; 587 (and 25) speak STARTTLS and must be sent in the
// clear first. Getting this pair wrong fails with an opaque OpenSSL "wrong version
// number", so the port drives the checkbox instead of leaving them to drift apart.
const secureForPort = (port: number) => port === 465

export function NewsletterFields() {
  const t = useAdminT()
  const { notify } = useToast()
  const [cfg, setCfg] = useState<MailStatus | null>(null)
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/mail')
      .then((r) => r.json() as Promise<ApiResponse<MailStatus>>)
      .then((j) => j.success && j.data && setCfg(j.data))
      .catch(() => {})
  }, [])

  function field<K extends keyof MailStatus>(k: K, v: MailStatus[K]) {
    setCfg((c) => (c ? { ...c, [k]: v } : c))
  }

  function setPort(port: number) {
    setCfg((c) => (c ? { ...c, port, secure: secureForPort(port) } : c))
  }

  async function save() {
    if (!cfg) return
    setBusy(true)
    try {
      const body: Record<string, unknown> = { host: cfg.host, port: cfg.port, user: cfg.user, from: cfg.from, secure: cfg.secure }
      if (pass) body.pass = pass
      const res = await fetch('/api/mail', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const j = (await res.json()) as ApiResponse<unknown>
      notify(j.success ? t.nlSmtpSaved : t.saveFailed, j.success ? 'success' : 'error')
      if (j.success) setPass('')
    } finally {
      setBusy(false)
    }
  }

  if (!cfg) return <p className="text-sm text-neutral-400">{t.loading}</p>

  const mismatch = cfg.secure !== secureForPort(cfg.port)

  return (
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
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={busy}>{t.nlSaveSmtp}</Button>
        <Link href="/admin/newsletter" className="text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">
          {t.nlManageLink} →
        </Link>
      </div>
    </div>
  )
}
