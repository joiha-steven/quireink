// Newsletter → Send: tick one or more published posts, look at the EXACT email that
// will go out, then send it. The preview is the real `broadcastEmail()` HTML rendered
// in a sandboxed iframe (not a mock-up), because reviewing something other than what
// ships is worse than not reviewing at all.
//
// Several posts = ONE digest email, so ticking three does not put three messages in a
// subscriber's inbox. Nothing sends automatically: the cron only publishes. A post that
// already has successful sends needs the resend checkbox before the button unlocks.
import { useEffect, useRef, useState } from 'react'
import type { ApiResponse } from '@/types'
import { Card, CHECK, NOTE_TEXT } from './kit'
import { Button } from '@/admin/ui/Button'
import { useToast } from '@/admin/ui/Toast'
import { useAdminT } from './I18nProvider'

type Stats = { sent: number; failed: number; opened: number; broadcasts: number; lastAt?: string }
export type SendablePost = { slug: string; title: string; date: string; stats: Stats | null }

type Preview = { subject: string; html: string; recipients: number }
type SendResult = { sent: number; failed: number; recipients: number }

export function NewsletterSend({ posts }: { posts: SendablePost[] }) {
  const t = useAdminT()
  const { notify } = useToast()
  const [picked, setPicked] = useState<string[]>(posts[0] ? [posts[0].slug] : [])
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  const [resend, setResend] = useState(false)
  const [sending, setSending] = useState(false)
  // THE LATCH. A newsletter cannot be unsent, so the button fires in two stages: the first
  // press ARMS it — it turns amber and prints the recipient count the send will use — and
  // only a second press inside five seconds sends. Esc, a click anywhere else, touching the
  // selection or running out of seconds stands it down. This replaced a native confirm(),
  // which asked its question in the browser's voice with none of the numbers.
  const [armed, setArmed] = useState(0) // seconds of arming left; 0 = at rest
  const latch = useRef<HTMLSpanElement>(null)
  // Sent counts come from the server on load; a send in this session is remembered here
  // so the button locks again without a page reload.
  const [sentNow, setSentNow] = useState<string[]>([])

  const isArmed = armed > 0
  useEffect(() => {
    if (!isArmed) return
    const id = setTimeout(() => setArmed((sLeft) => sLeft - 1), 1000)
    return () => clearTimeout(id)
  }, [armed])
  useEffect(() => {
    if (!isArmed) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setArmed(0) }
    const away = (e: MouseEvent) => {
      if (!latch.current?.contains(e.target as Node)) setArmed(0)
    }
    document.addEventListener('keydown', key)
    document.addEventListener('click', away)
    return () => {
      document.removeEventListener('keydown', key)
      document.removeEventListener('click', away)
    }
  }, [isArmed])

  // Keep the picked list in the page's own order, so the digest's lead post is the
  // newest one ticked rather than whichever checkbox was clicked first.
  function toggle(slug: string) {
    setPicked((cur) => {
      const next = cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug]
      return posts.filter((p) => next.includes(p.slug)).map((p) => p.slug)
    })
    setResend(false)
  }

  const priorSent = picked.filter((s) => sentNow.includes(s) || (posts.find((p) => p.slug === s)?.stats?.sent ?? 0) > 0)
  const alreadySent = priorSent.length > 0
  const key = picked.join(',')

  // An armed latch is armed for ONE exact selection; changing anything stands it down.
  useEffect(() => setArmed(0), [key, resend])

  useEffect(() => {
    if (!key) return // nothing ticked — the pane renders its own hint, no state to clear
    const ctrl = new AbortController()
    const qs = key.split(',').map((s) => `slug=${encodeURIComponent(s)}`).join('&')
    fetch(`/api/broadcast?${qs}`, { signal: ctrl.signal })
      .then((r) => r.json() as Promise<ApiResponse<Preview>>)
      .then((j) => {
        setPreview(j.success && j.data ? j.data : null)
        setLoading(false)
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [key])

  async function press() {
    if (picked.length === 0 || sending) return
    if (!isArmed) {
      setArmed(5)
      return
    }
    setArmed(0)
    setSending(true)
    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slugs: picked, force: resend }),
      })
      const j = (await res.json()) as ApiResponse<SendResult>
      if (j.success && j.data) {
        setSentNow((s) => [...new Set([...s, ...picked])])
        setResend(false)
        notify(t.nlSendDone.replace('{sent}', String(j.data.sent)).replace('{total}', String(j.data.recipients)), 'success')
      } else {
        notify(`${t.nlSendFailed}: ${j.success ? '' : j.error}`, 'error')
      }
    } catch {
      notify(t.nlSendFailed, 'error')
    } finally {
      setSending(false)
    }
  }

  if (posts.length === 0) return <p className="text-sm text-neutral-500 dark:text-neutral-400">{t.nlNoPosts}</p>

  return (
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <Card title={t.nlPickPost}>
        <div className="space-y-4">
          <div className="scroll-fade max-h-80 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            {posts.map((p) => {
              const done = sentNow.includes(p.slug) || (p.stats?.sent ?? 0) > 0
              return (
                <label
                  key={p.slug}
                  className="flex cursor-pointer items-start gap-3 border-b border-neutral-100 px-3.5 py-2.5 last:border-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/40"
                >
                  <input type="checkbox" className={`mt-1 ${CHECK}`} checked={picked.includes(p.slug)} onChange={() => toggle(p.slug)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-neutral-800 dark:text-neutral-100">{p.title}</span>
                    <span className="mt-0.5 block text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                      {p.date.slice(0, 10)}
                      {done && ` · ${t.nlAlreadySentShort}`}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
          <p className={NOTE_TEXT}>
            {picked.length > 1 ? t.nlDigestHint.replace('{n}', String(picked.length)) : t.nlSendHint}
          </p>

          {alreadySent && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-neutral-600 dark:text-neutral-400">{t.nlAlreadySent.replace('{n}', String(priorSent.length))}</p>
              <label className="mt-2 flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
                <input type="checkbox" className={CHECK} checked={resend} onChange={(e) => setResend(e.target.checked)} />
                {t.nlResendConfirm}
              </label>
            </div>
          )}

          {/* The span, not the Button, carries the ref: ui/Button does not forward one,
              and the outside-click test only needs to know the latch's own footprint. */}
          <span ref={latch} className="inline-flex">
            <Button variant={isArmed || sending ? 'armed' : 'primary'} onClick={press} disabled={sending || picked.length === 0 || (alreadySent && !resend)}>
              {/* While the send is in flight the button wears the amber face and a
                  BREATHING lamp — running work, in the running-work colour. Reduced
                  motion keeps the lamp lit and drops the breath. */}
              {sending && (
                <span aria-hidden className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500 motion-reduce:animate-none" />
              )}
              {sending
                ? t.loading
                : isArmed
                  ? t.nlArmed.replace('{n}', preview ? String(preview.recipients) : '…').replace('{s}', String(armed))
                  : t.nlSendButton}
            </Button>
          </span>
        </div>
      </Card>

      <Card title={t.nlPreview}>
        {picked.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{t.nlPreviewEmpty}</p>
        ) : loading ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{t.loading}</p>
        ) : !preview ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{t.nlPreviewFailed}</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="text-neutral-500 dark:text-neutral-400">{t.nlSubjectLabel}: </span>
              <span className="font-medium">{preview.subject}</span>
            </p>
            {/* sandbox with no allow-* tokens: the email HTML cannot run scripts, submit
                forms or navigate the admin. It is only ever rendered, never trusted. */}
            <iframe
              title={t.nlPreview}
              sandbox=""
              srcDoc={preview.html}
              className="h-[34rem] w-full rounded-lg border border-neutral-200 bg-white dark:border-neutral-800"
            />
            <p className={NOTE_TEXT}>{t.nlPreviewHint}</p>
          </div>
        )}
      </Card>
    </div>
  )
}
