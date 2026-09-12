// What changed, once, after an upgrade — and, for a blog that predates the question, the one
// question this release wants an answer to.
//
// WHY A PANEL AND NOT A BADGE. Somebody self-hosting this updates it by pulling an image;
// nothing in that act tells them what they got, and the CHANGELOG is a file on a machine
// they may never open. The update check already tells a blog when a newer release exists
// (`server/update-check.ts`); this is the other half — what the one you just installed IS.
//
// ONE FIELD DECIDES ALL OF IT: `settings.seenRelease`, the release this blog has already been
// shown. It is empty on a blog whose settings row predates the field, which is exactly the
// blog that has never been asked which dialect to wear — the four looks shipped after it was
// installed, and the setup question that asks is one it never saw. So:
//
//   seen === version   nothing. The common case, and it costs one string comparison.
//   seen is a version  the news alone. They have been asked; asking again is nagging.
//   seen is EMPTY      the news AND the question, because this blog was never asked.
//
// A fresh install is stamped by the last step of setup, so it never meets this panel for the
// release it was installed on — which is the whole point of stamping it there rather than
// here.
//
// THE NOTES THEMSELVES ARE A LINK, not a copy. Release notes are written once, in English,
// per release; carrying them in the build would mean eleven translations of prose that
// changes every release, or eleven languages framing an English paragraph badly. The frame
// is translated and the notes stay where they are written.
import { useState } from 'react'
import type { SiteLook } from '@/types'
import { api } from '@/admin/api'
import { useAdminT } from './I18nProvider'
import { OVERLAY } from './sheet'
import { SECTION, UTIL } from './scale'
import { REPO } from './help-kit'
import { Button } from '@/admin/ui/Button'

/** The four dialects, in the order the Settings field and the setup step both use. */
const LOOKS: SiteLook[] = ['plain', 'code', 'paper', 'notes']

export function WhatsNew({ version, seen, look }: {
  version: string
  seen: string
  look: SiteLook
}) {
  const t = useAdminT()
  // Read ONCE, into state. `seen` changes under this component the moment the button is
  // pressed — the shell refetches — and a panel that decides whether to exist from a prop
  // that its own button changes would vanish mid-animation rather than close.
  const [open, setOpen] = useState(seen !== version)
  const [chosen, setChosen] = useState<SiteLook>(look)
  const [saving, setSaving] = useState(false)
  const askLook = seen === ''

  if (!open) return null

  const names: Record<SiteLook, string> = {
    plain: t.lookPlain, code: t.lookCode, paper: t.lookPaper, notes: t.lookNotes,
  }

  // Saved on the press rather than on Done, so the choice survives a panel closed by the
  // Escape key or a reload — and so the blog is already wearing it when they go and look.
  const pick = async (id: SiteLook) => {
    setChosen(id)
    await api.put('/api/settings', { look: id }).catch(() => { /* the toast layer reports */ })
  }

  const close = async () => {
    setOpen(false)
    setSaving(true)
    // Written LAST. If this throws, the panel is gone for this page load and comes back on
    // the next one, which is the right failure: the news is worth showing twice and never
    // showing is worse.
    await api.put('/api/settings', { seenRelease: version })
      .catch(() => { /* shown again next load */ })
    setSaving(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/30 p-4 backdrop-blur-[2px]"
      onMouseDown={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.newsTitle}
        data-whats-new
        onMouseDown={(e) => e.stopPropagation()}
        className={`max-h-[80vh] w-full max-w-lg overflow-y-auto p-5 ${OVERLAY}`}
      >
        <h2 className={SECTION}>{t.newsTitle}</h2>
        <p className="mt-1.5 text-sm leading-[1.55] text-neutral-600 dark:text-neutral-400">
          {t.newsBody.replace('{v}', version)}{' '}
          <a
            href={`${REPO}/releases/tag/v${version}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-500 dark:decoration-neutral-600"
          >
            {t.newsNotes}
          </a>
        </p>

        {askLook && (
          <section className="mt-5">
            <h3 className={`${UTIL} mb-1.5`}>{t.lookLabel}</h3>
            <p className="mb-3 text-sm leading-[1.55] text-neutral-600 dark:text-neutral-400">
              {t.lookStepLede}
            </p>
            {/* Words and not drawings, unlike the setup step. There the four are met cold and
                a diagram is the only way to carry them; here the blog already exists, the
                owner can press one and go look at it, and four pictures in a panel that
                interrupts them is a screen rather than a question. */}
            <div className="flex flex-wrap gap-2">
              {LOOKS.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={id === chosen}
                  onClick={() => void pick(id)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    id === chosen
                      ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                      : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800'
                  }`}
                >
                  {names[id]}
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="mt-6 flex justify-end">
          <Button onClick={() => void close()} disabled={saving}>{t.newsDone}</Button>
        </div>
      </div>
    </div>
  )
}
