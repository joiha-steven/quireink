// The AI card (Admin → Settings → AI). Two halves in one card, split by what saves them:
//
//  - The MODEL half (provider, key, model) is a SECRET, so it has its own API
//    (/api/integrations/ai → the server-only `integration_keys` table) and its own Save.
//    Paste a key and the models list themselves (/api/integrations/ai/models) — the
//    owner picks from what their account can actually see, not from memory.
//  - The JOBS half is plain settings (`settings.ai`), saved by the page's own Save
//    button like every other switch. Every job defaults ON; the master switch is the
//    key itself, so with no model configured the switches show off and stay disabled.
//
// ⚠️ The first cut of this card was built out of hand-written classes — its own `INPUT`
// constant, two bare `<select>`s and three bare `<input type="checkbox">`. Photographed on
// 2026-08-24 beside the MCP card next to it, that was: the OS chevron against the kit's
// drawn one, an OS-BLUE tick in a monochrome admin (the exact failure `check:admin-kit`
// guards, which the copy dodged by carrying no accent class at all), three controls with no
// labels, and a boolean drawn as a checkbox eighty pixels from the same boolean drawn as a
// switch. Everything visible here now comes from the kit; the card next door and the SMTP
// card on Connections are what it is meant to match.
import { useEffect, useRef, useState } from 'react'
import { useRouter } from '@/admin/router'
import type { ApiResponse, AiSettings } from '@/types'
import { Button } from '@/admin/ui/Button'
import { Input } from '@/admin/ui/Input'
import { ToggleRow } from '@/admin/ui/Switch'
import { useToast } from '@/admin/ui/Toast'
import { useAdminT } from './I18nProvider'
import { FIELD_W, NOTE_TEXT, PANEL_LIST, Select, Setting, SETTING_GAP } from './kit'

type Choice = { id: string; label: string }

export function AiFields({ configured, provider, model, seesImages, ai, onChangeAi }: {
  configured: boolean; provider: string; model: string; seesImages: boolean
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
  // A saved model with no list to pick from still has to be SHOWN. The list fails on a
  // bad key, a rate limit or an office firewall, and the first cut rendered nothing at
  // all in that state — so a blog with a model quietly working for it displayed no model
  // anywhere. Same chrome, disabled: obviously not a menu, still an answer.
  const modelControl = models.length > 0
    ? (
      <Select wrapClassName="flex w-full" className="w-full" value={chosen} onChange={(e) => setChosen(e.target.value)}>
        {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
      </Select>
    )
    : chosen
      ? (
        <Select wrapClassName="flex w-full" className="w-full" value={chosen} disabled>
          <option value={chosen}>{chosen}</option>
        </Select>
      )
      : null

  return (
    <div className={SETTING_GAP}>
      <p className={NOTE_TEXT}>{t.aiHelp}</p>

      <Setting label={t.aiProviderLabel} inline>
        <Select
          className={FIELD_W.medium}
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
          <option value="deepseek">DeepSeek</option>
        </Select>
      </Setting>

      {!off && (
        <>
          <Input
            label={t.aiKeyLabel}
            note={configured ? t.aiKeyStored : undefined}
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onBlur={() => { if (key.trim()) void loadModels(pick, key.trim()) }}
            placeholder={t.aiKeyPh}
            autoComplete="off"
          />

          <Setting
            label={t.aiModelLabel}
            note={listing === 'loading' ? t.aiModelsLoading : listing === 'failed' ? t.aiModelsFailed : undefined} inline>
            {modelControl}
          </Setting>
        </>
      )}

      <Button type="button" onClick={() => void save()} disabled={busy}>
        {t.commentsKeySave}
      </Button>

      {/* THE KEY IS THE SWITCH, for everything the model does with the owner's OWN
          material. Alt text and excerpts used to be two more decisions on this card, and
          they were decisions about nothing: an owner who has just pasted a key and paid
          for a model wants it describing their pictures and drafting their excerpts.
          Both now follow the key, and alt text additionally follows the model — a
          text-only one cannot do it, and the line below says so instead of offering a
          switch that would never fire.

          THE COMMENT GUARD KEEPS ITS SWITCH, and it is the one difference that matters.
          The other two jobs read only what the owner wrote. This one sends a READER'S
          words to a third party, which is a decision about somebody else's data, and the
          person who has to declare it in a privacy policy is the person who should be
          asked. Defaulting it on would start that traffic with nobody agreeing to it. */}
      <div className="border-t border-neutral-100 pt-5 dark:border-neutral-800">
        <Setting label={t.aiTasksLabel} note={configured ? undefined : t.aiTasksNeedModel}>
          <p className={NOTE_TEXT}>
            {seesImages ? t.aiAutoJobs : `${t.aiAutoJobs} ${t.aiCannotSeeImages}`}
          </p>
          <div className={`${PANEL_LIST} mt-3`}>
            <ToggleRow
              label={t.aiTaskComments}
              desc={t.aiTaskCommentsDesc}
              checked={configured ? ai.commentGuard : false}
              disabled={!configured}
              onChange={(v) => onChangeAi({ ...ai, commentGuard: v })}
            />
          </div>
        </Setting>
      </div>
    </div>
  )
}
