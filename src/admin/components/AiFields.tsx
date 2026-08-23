// The AI describer's card (Admin → Settings → Connections). The key is a SECRET, so it
// has its own API (/api/integrations/ai -> the server-only `integration_keys` table),
// never the settings form. Write-to-set, like the Cloudflare card beside it: a blank
// field leaves the stored value untouched, and choosing "Off" as the provider is the
// one explicit way to turn the whole thing off.
import { useState } from 'react'
import { useRouter } from '@/admin/router'
import type { ApiResponse } from '@/types'
import { Button } from '@/admin/ui/Button'
import { useToast } from '@/admin/ui/Toast'
import { useAdminT } from './I18nProvider'
import { NOTE_TEXT } from './kit'

const INPUT =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100'

// Mirrors DEFAULT_MODELS in media/alt-text.ts; shown as the model placeholder so the
// owner sees what "leave it blank" means for the provider they picked.
const DEFAULTS: Record<string, string> = {
  anthropic: 'claude-haiku-4-5', openai: 'gpt-4o-mini', gemini: 'gemini-2.0-flash',
}

export function AiFields({ configured, provider, model }: {
  configured: boolean; provider: string; model: string
}) {
  const t = useAdminT()
  const router = useRouter()
  const { notify } = useToast()
  const [pick, setPick] = useState(provider)
  const [key, setKey] = useState('')
  const [modelIn, setModelIn] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    // The provider is ALWAYS sent — '' is how "Off" clears it. Key and model only when
    // typed, so a blank never wipes a stored value.
    const body: Record<string, string> = { aiProvider: pick }
    if (key.trim()) body.aiApiKey = key.trim()
    if (modelIn.trim()) body.aiModel = modelIn.trim()
    try {
      const res = await fetch('/api/integrations/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as ApiResponse
      if (!json.success) throw new Error(json.error)
      setKey('')
      setModelIn('')
      notify(t.commentsKeySaved)
      router.refresh()
    } catch {
      notify(t.deleteFailed, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className={NOTE_TEXT}>{t.aiHelp}</p>
      <select className={INPUT} value={pick} onChange={(e) => setPick(e.target.value)}>
        <option value="">{t.aiProviderOff}</option>
        <option value="anthropic">Anthropic (Claude)</option>
        <option value="openai">OpenAI (GPT)</option>
        <option value="gemini">Google (Gemini)</option>
      </select>
      <input
        className={INPUT}
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder={configured ? `${t.aiKeyPh} · ${t.commentsKeySet}` : t.aiKeyPh}
        autoComplete="off"
      />
      <input
        className={INPUT}
        value={modelIn}
        onChange={(e) => setModelIn(e.target.value)}
        placeholder={model || DEFAULTS[pick] || 'model'}
        autoComplete="off"
      />
      <Button onClick={() => void save()} disabled={busy || (!pick && !configured)}>
        {t.commentsKeySave}
      </Button>
    </div>
  )
}
