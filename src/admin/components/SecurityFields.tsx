// The account: the password, the second factor, the recovery codes, and every device signed in.
//
// The routes behind this are new (`web/admin/security.ts`) and so is the screen. The spec has
// promised it since it was written; nothing had ever been built, while `listSessions` and
// `revokeAllSessions` sat in `src/auth/` finished and called by nobody.
//
// Everything that CHANGES something asks for the current password, so the shape of this
// screen is one confirm field at the top and the three actions under it. That is deliberate:
// the threat these controls answer is somebody else already holding a session, and one place
// to type the password makes it obvious that the session alone is not enough.
//
// Ending a session asks for nothing, because it only ever removes access.
import { useEffect, useState } from 'react'
import { ApiError, api } from '@/admin/api'
import { Button } from '@/admin/ui/Button'
import { useToast } from '@/admin/ui/Toast'
import { formatDateTimeShort } from '@/utils'
import { CONTROL, NOTE_TEXT, PANEL, Setting, SETTING_GAP } from './kit'
import { useAdminT } from './I18nProvider'

type Session = { id: string; device: string; createdAt: string; lastSeenAt: string; current: boolean }
type State = { currentSessionId: string; recoveryLeft: number; totpEnabled: boolean; sessions: Session[] }

/** The one place the password is typed, shared by all three actions. */
export function SecurityFields() {
  const t = useAdminT()
  const { notify } = useToast()
  const [state, setState] = useState<State | null>(null)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [codes, setCodes] = useState<string[] | null>(null)
  const [enrol, setEnrol] = useState<{ secret: string; uri: string } | null>(null)
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)

  const load = (): void => { void api.get<State>('/api/security').then(setState).catch(() => { /* the toast said it */ }) }
  useEffect(load, [])

  /**
   * Every call goes through one place, so a refusal is reported the same way once.
   *
   * The server answers with a CODE (`wrong_password`, `too-short`), never a sentence — `src/i18n`
   * is the only home for user text — so the mapping to something readable lives here.
   */
  const REASON: Record<string, string> = {
    wrong_password: t.securityWrongPassword,
    too_many_attempts: t.securityTooMany,
    bad_code: t.securityBadCode,
    'too-short': t.pwTooShort,
    'too-common': t.pwTooCommon,
    'contains-name': t.pwContainsName,
  }
  const send = async <T,>(run: () => Promise<T>): Promise<T | null> => {
    setBusy(true)
    try {
      return await run()
    } catch (error) {
      const code = error instanceof ApiError ? error.message : ''
      notify(REASON[code] ?? t.saveFailed, 'error')
      return null
    } finally {
      setBusy(false)
    }
  }

  const changePassword = async () => {
    const out = await send(() => api.post<{ signedOut: number }>('/api/security/password', { current, next }))
    if (!out) return
    setCurrent(''); setNext('')
    notify(t.securityPasswordChanged.replace('{n}', String(out.signedOut)), 'success')
    load()
  }

  const mintCodes = async () => {
    const out = await send(() => api.post<{ codes: string[] }>('/api/security/recovery', { current }))
    if (!out) return
    setCurrent('')
    setCodes(out.codes)
    load()
  }

  const startEnrol = async () => {
    const out = await send(() => api.post<{ secret: string; uri: string }>('/api/security/totp/start', { current }))
    if (!out) return
    setEnrol(out)
  }

  const confirmEnrol = async () => {
    if (!enrol) return
    const out = await send(() => api.post('/api/security/totp/confirm', { current, secret: enrol.secret, code: otp }))
    if (!out) return
    setEnrol(null); setOtp(''); setCurrent('')
    notify(t.securityTotpDone, 'success')
    load()
  }

  const endSession = async (id: string) => {
    if (!(await send(() => api.delete(`/api/security/sessions/${encodeURIComponent(id)}`)))) return
    load()
  }

  const endOthers = async () => {
    const out = await send(() => api.post<{ signedOut: number }>('/api/security/sessions/revoke-others', {}))
    if (!out) return
    notify(t.securitySignedOut.replace('{n}', String(out.signedOut)), 'success')
    load()
  }

  return (
    <div className={SETTING_GAP}>
      <Setting label={t.securityConfirm} note={t.securityConfirmHint}>
        <input
          type="password"
          value={current}
          autoComplete="current-password"
          onChange={(e) => setCurrent(e.target.value)}
          data-security-current
          className={`${CONTROL} w-full max-w-sm`}
        />
      </Setting>

      <Setting label={t.securityNewPassword}>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="password"
            value={next}
            autoComplete="new-password"
            onChange={(e) => setNext(e.target.value)}
            className={`${CONTROL} w-full max-w-sm`}
          />
          <Button variant="secondary" disabled={busy || !current || !next} onClick={() => void changePassword()}>
            {t.securityChangePassword}
          </Button>
        </div>
        {/* Said BEFORE the button is pressed, because it is the surprising half and it is
            the half somebody doing this actually wants. */}
        <p className={`${NOTE_TEXT} mt-1.5`}>{t.securityPasswordSignsOut}</p>
      </Setting>

      <Setting label={t.securityRecovery} note={t.securityRecoveryHint.replace('{n}', String(state?.recoveryLeft ?? 0))} inline>
        <Button variant="secondary" disabled={busy || !current} onClick={() => void mintCodes()}>
          {t.securityNewCodes}
        </Button>
      </Setting>

      {codes && (
        // Shown once and never again: `regenerateCodes` replaced the old set, so this list is
        // the only copy that will ever exist.
        <div className={PANEL}>
          <p className={NOTE_TEXT}>{t.securityCodesOnce}</p>
          <ul className="mt-2 grid gap-1 font-mono text-sm sm:grid-cols-2" data-security-codes>
            {codes.map((code) => <li key={code}>{code}</li>)}
          </ul>
        </div>
      )}

      <Setting label={t.securityTotp} note={state?.totpEnabled ? t.securityTotpOn : t.securityTotpOff} inline>
        <Button variant="secondary" disabled={busy || !current} onClick={() => void startEnrol()}>
          {t.securityReenrol}
        </Button>
      </Setting>

      {enrol && (
        <div className={PANEL}>
          <p className={NOTE_TEXT}>{t.securityScanHint}</p>
          <code className="mt-2 block break-all font-mono text-xs">{enrol.secret}</code>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={otp}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              onChange={(e) => setOtp(e.target.value)}
              className={`${CONTROL} w-32 text-center font-mono tabular-nums`}
            />
            <Button disabled={busy || otp.length < 6} onClick={() => void confirmEnrol()}>{t.securityConfirmCode}</Button>
            <Button variant="secondary" onClick={() => { setEnrol(null); setOtp('') }}>{t.close}</Button>
          </div>
        </div>
      )}

      <Setting label={t.securitySessions} note={t.securitySessionsHint}>
        <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {(state?.sessions ?? []).map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2" data-security-session>
              <span className="min-w-0">
                <span className="block text-sm text-neutral-700 dark:text-neutral-300">
                  {s.device || t.securityUnknownDevice}
                  {s.current && <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">{t.securityThisDevice}</span>}
                </span>
                <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                  {t.securityLastSeen} {formatDateTimeShort(s.lastSeenAt)}
                </span>
              </span>
              <Button variant="secondary" disabled={busy} onClick={() => void endSession(s.id)}>
                {s.current ? t.securitySignOutThis : t.securitySignOut}
              </Button>
            </li>
          ))}
        </ul>
        {(state?.sessions.length ?? 0) > 1 && (
          <Button variant="secondary" className="mt-3" disabled={busy} onClick={() => void endOthers()}>
            {t.securitySignOutOthers}
          </Button>
        )}
      </Setting>
    </div>
  )
}
