// The AI card (Admin → Settings → AI). Two halves in one card, split by what saves them:
//
//  - The MODEL half (provider, key, model) is a SECRET, so it has its own API
//    (/api/integrations/ai → the server-only `integration_keys` table) and its own Save.
//    Paste a key and the models list themselves (/api/integrations/ai/models) — the
//    owner picks from what their account can actually see, not from memory.
//  - The JOBS half is plain settings (`settings.ai`), saved by the page's own Save
//    button like every other switch. Every job defaults ON; the master switch is the
//    key itself, so with no model configured the switches show off and stay disabled.
import { useEffect, useRef, useState } from 'react'
import { useRouter } from '@/admin/router'
import type { ApiResponse, AiSettings } from '@/types'
import { Button } from '@/admin/ui/Button'
import { useToast } from '@/admin/ui/Toast'
import { useAdminT } from './I18nProvider'
import { NOTE_TEXT } from './kit'

const INPUT =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100'

type Choice = { id: string; label: string }

export function AiFields({ configured, provider, model, ai, onChangeAi }: {
  configured: boolean; provider: string; model: string
  ai: AiSettings; onChangeAi: (ai: AiSettings) => void
}) {
  const t = useAdminT()
  const router = useRouter()
  const { notify } = useToast()
  const [pick, setPick] = useState(provider)
  const [key, setKey] = useState('')
  const [models, setModels] = useState<Choice[]>([])
  const [chosen, setChosen] = useState(model)
  const [listing, setListing] = useState<'idle' | 'loading' | 'failed'>('idle')
  const [busy, setBusy] = useState(false)
  const fetchSeq = useRef(0)

  // The menu loads the moment it CAN: a stored key on mount, a pasted key on blur, a
  // provider change while either exists. A stale response must not overwrite a newer
  // one, hence the sequence number.
  async function loadModels(p: string, typedKey: string) {
    if (!p || (!typedKey && !configured)) return
    const seq = ++fetchSeq.current
    setListing('loading')
    try {
      const res = await fetch('/api/integrations/ai/models', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(typedKey ? { provider: p, apiKey: typedKey } : { provider: p }),
      })
      const json = (await res.json()) as ApiResponse<{ models: Choice[] }>
      if (seq !== fetchSeq.current) return
      if (!json.success || !json.data) throw new Error(json.error)
      setModels(json.data.models)
      setListing('idle')
      if (json.data.models.length > 0 && !json.data.models.some((m) => m.id === chosen)) {
        setChosen(json.data.models[0]!.id)
      }
    } catch {
      if (seq === fetchSeq.current) setListing('failed')
    }
  }

  useEffect(() => {
    if (configured && provider) void loadModels(provider, '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save() {
    setBusy(true)
    // The provider is ALWAYS sent — '' is how "Off" clears it. Key and model only when
    // present, so a blank never wipes a stored value.
    const body: Record<string, string> = { aiProvider: pick }
    if (key.trim()) body.aiApiKey = key.trim()
    if (chosen) body.aiModel = chosen
    try {
      const res = await fetch('/api/integrations/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as ApiResponse
      if (!json.success) throw new Error(json.error)
      setKey('')
      notify(t.commentsKeySaved)
      router.refresh()
    } catch {
      notify(t.deleteFailed, 'error')
    } finally {
      setBusy(false)
    }
  }

  const off = !pick
  return (
    <div className="space-y-3">
      <p className={NOTE_TEXT}>{t.aiHelp}</p>

      <select
        className={INPUT}
        value={pick}
        onChange={(e) => {
          const p = e.target.value
          setPick(p)
          setModels([])
          if (p) void loadModels(p, key.trim())
        }}
      >
        <option value="">{t.aiProviderOff}</option>
        <option value="anthropic">Anthropic (Claude)</option>
        <option value="openai">OpenAI (GPT)</option>
        <option value="gemini">Google (Gemini)</option>
      </select>

      {!off && (
        <>
          <input
            className={INPUT}
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onBlur={() => { if (key.trim()) void loadModels(pick, key.trim()) }}
            placeholder={configured ? `${t.aiKeyPh} · ${t.commentsKeySet}` : t.aiKeyPh}
            autoComplete="off"
          />
          {models.length > 0 ? (
            <select className={INPUT} value={chosen} onChange={(e) => setChosen(e.target.value)}>
              {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          ) : (
            <p className={NOTE_TEXT}>
              {listing === 'loading' ? t.aiModelsLoading : listing === 'failed' ? t.aiModelsFailed : ''}
            </p>
          )}
        </>
      )}

      <Button type="button" onClick={() => void save()} disabled={busy}>
        {t.commentsKeySave}
      </Button>

      {/* The jobs. Saved with the page's Save button; greyed to off while no model is
          configured, because a switch wired to nothing should look like one. */}
      <div className="border-t border-neutral-200 pt-3 dark:border-neutral-800">
        <p className={`${NOTE_TEXT} mb-2`}>{t.aiTasksLabel}</p>
        <label className={`flex items-center gap-2 text-sm ${configured ? 'text-neutral-700 dark:text-neutral-200' : 'text-neutral-400 dark:text-neutral-600'}`}>
          <input
            type="checkbox"
            checked={configured ? ai.altText : false}
            disabled={!configured}
            onChange={(e) => onChangeAi({ ...ai, altText: e.target.checked })}
          />
          {t.aiTaskAltText}
        </label>
      </div>
    </div>
  )
}
