// MCP server card (Advanced settings): an enable toggle (part of the settings form)
// plus a self-contained token manager. Tokens have their own API (/api/mcp/tokens)
// because the plaintext is shown ONCE on creation and never retrievable again — so
// this part owns its state and does not flow through the settings save.
import { useCallback, useEffect, useState } from 'react'
import type { McpSettings } from '@/types'
import type { McpTokenInfo } from '@/mcp/tokens'
import type { ApiResponse } from '@/types'
import { Button } from '@/admin/ui/Button'
import { ToggleRow } from '@/admin/ui/Switch'
import { useToast } from '@/admin/ui/Toast'
import { formatDateTimeShort } from '@/utils'
import { useAdminT } from './I18nProvider'
import { PANEL, PANEL_LIST, Setting, TABLE_SCROLL } from './kit'

const MAX = 5 // manual tokens only; OAuth-connector tokens are exempt

export function McpFields(
  { mcp, siteUrl, onChange }:
  { mcp: McpSettings; siteUrl: string; onChange: (m: McpSettings) => void },
) {
  const t = useAdminT()
  // The address a connector is pointed at. `siteUrl` may be blank, in which case the server
  // derives it from the environment — which the browser cannot read, so fall back to the
  // origin the owner is looking at. Those agree on any ordinary install, and the fallback is
  // the more useful of the two when they do not: it is reachable by definition.
  const endpoint = `${(siteUrl || window.location.origin).replace(/\/+$/, '')}/api/mcp`
  const { notify } = useToast()
  const [tokens, setTokens] = useState<McpTokenInfo[]>([])
  const [created, setCreated] = useState<string | null>(null) // plaintext shown once
  const [pending, setPending] = useState(false)
  // Scope for the NEXT token. Unchecked mints 'full' — what every token was before scopes
  // existed, and what a connector that publishes needs.
  const [readScope, setReadScope] = useState(false)

  // Refresh used by the create/delete handlers (event handlers — setState is fine).
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/mcp/tokens')
      const json = (await res.json()) as ApiResponse<McpTokenInfo[]>
      if (json.success && json.data) setTokens(json.data)
    } catch {
      /* non-fatal: the card still shows the toggle */
    }
  }, [])

  // Initial load — inline fetch chain (setState inside a .then callback, not the body).
  useEffect(() => {
    fetch('/api/mcp/tokens')
      .then((r) => r.json() as Promise<ApiResponse<McpTokenInfo[]>>)
      .then((j) => {
        if (j.success && j.data) setTokens(j.data)
      })
      .catch(() => {})
  }, [])

  // Refetch whenever the owner returns to this tab — connectors are created/revoked
  // out-of-band (in Claude), so the list must re-sync or it shows a stale snapshot
  // ("I reconnected but don't see it"). Listeners only, so no setState in the body.
  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [refresh])

  async function generate() {
    const name = prompt(t.mcpNamePrompt)?.trim()
    if (!name) return
    setPending(true)
    try {
      const res = await fetch('/api/mcp/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, scope: readScope ? 'read' : 'full' }),
      })
      const json = (await res.json()) as ApiResponse<{ token: string; info: McpTokenInfo }>
      if (!json.success || !json.data) {
        notify(json.error === 'token_limit' ? t.mcpLimitReached : t.mcpCreateFailed, 'error')
        return
      }
      setCreated(json.data.token)
      await refresh()
    } catch {
      notify(t.mcpCreateFailed, 'error')
    } finally {
      setPending(false)
    }
  }

  async function remove(id: number) {
    if (!confirm(t.mcpConfirmDelete)) return
    setPending(true)
    try {
      const res = await fetch(`/api/mcp/tokens/${id}`, { method: 'DELETE' })
      const json = (await res.json()) as ApiResponse
      if (!json.success) throw new Error(json.error)
      notify(t.mcpTokenDeleted)
      await refresh()
    } catch {
      notify(t.mcpCreateFailed, 'error')
    } finally {
      setPending(false)
    }
  }

  async function copy(value: string, message: string) {
    try {
      await navigator.clipboard.writeText(value)
      notify(message)
    } catch {
      /* clipboard blocked — the value is visible to select manually */
    }
  }

  return (
    <div className="space-y-5">
      <div className={PANEL_LIST}>
        <ToggleRow
          label={t.mcpEnable}
          desc={t.mcpEnableDesc}
          checked={mcp.enabled}
          onChange={(enabled) => onChange({ ...mcp, enabled })}
        />

        {/* The endpoint itself. Everything else on this card assumes the owner already knows
            where to point a client, and nothing anywhere told them. */}
        {mcp.enabled && (
          <div className="border-t border-neutral-200 p-4 dark:border-neutral-800">
            <Setting label={t.mcpUrlLabel} note={t.mcpUrlHint}>
              <div className="flex items-center gap-2">
                {/* `min-h-9` matches the button beside it. Without it the box was 28px next
                    to a 40px button, which is what "the button is bigger than the field"
                    was. `min-w-0` is what lets the URL truncate instead of shoving. */}
                <code className="flex min-h-9 min-w-0 flex-1 items-center truncate rounded-lg border border-neutral-300 bg-neutral-50 px-3 text-xs dark:border-neutral-700 dark:bg-neutral-900">
                  {endpoint}
                </code>
                <Button type="button" variant="secondary" onClick={() => copy(endpoint, t.mcpUrlCopied)}>{t.mcpCopy}</Button>
              </div>
            </Setting>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {/* Label, note, then the controls under them — the same order as every other
            setting. Side by side these two buttons had nowhere to go but into their own
            labels: the note beside them is three lines of prose on a narrow card. */}
        <Setting label={t.mcpTokensTitle} note={t.mcpTokensHint} inline>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={generate} disabled={pending || tokens.filter((tk) => !tk.oauth).length >= MAX}>
              {t.mcpGenerate}
            </Button>
            <Button type="button" variant="ghost" onClick={() => refresh()}>{t.mcpRefresh}</Button>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300" title={t.mcpReadOnlyHint}>
              <input
                type="checkbox"
                checked={readScope}
                onChange={(e) => setReadScope(e.target.checked)}
                className="size-4 rounded border-neutral-300 dark:border-neutral-700"
              />
              {t.mcpReadOnly}
            </label>
          </div>
        </Setting>

        {/* The just-created plaintext token, shown ONCE. */}
        {created && (
          <div className="space-y-2 rounded-lg border border-neutral-300 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800/60">
            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300">{t.mcpOnceWarning}</p>
            <div className="flex items-center gap-2">
              <code className="flex min-h-9 min-w-0 flex-1 items-center truncate rounded-lg border border-neutral-300 bg-white px-3 text-xs dark:border-neutral-700 dark:bg-neutral-900">
                {created}
              </code>
              <Button type="button" onClick={() => copy(created, t.mcpCopied)}>{t.mcpCopy}</Button>
              <Button type="button" variant="ghost" onClick={() => setCreated(null)}>{t.close}</Button>
            </div>
          </div>
        )}

        {tokens.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">{t.mcpNoTokens}</p>
        ) : (
          <div className={PANEL}>
            <div className={TABLE_SCROLL}>
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500 dark:text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
                <tr>
                  <th className="px-3 py-2 font-medium">{t.mcpColName}</th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">{t.mcpColCreated}</th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">{t.mcpColLastUsed}</th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">{t.mcpColExpires}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {tokens.map((tok) => (
                  <tr key={tok.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                    <td className="px-3 py-2">
                      <span className="font-medium">{tok.name}</span>
                      <code className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">{tok.prefix}…</code>
                      {tok.scope === 'read' && (
                        <span className="ml-2 rounded border border-neutral-300 px-1.5 py-0.5 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                          {t.mcpReadOnly}
                        </span>
                      )}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2 text-neutral-500 sm:table-cell dark:text-neutral-400">
                      {formatDateTimeShort(tok.createdAt)}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2 text-neutral-500 sm:table-cell dark:text-neutral-400">
                      {tok.lastUsedAt ? formatDateTimeShort(tok.lastUsedAt) : t.mcpNeverUsed}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2 sm:table-cell">
                      {tok.expired ? (
                        <span className="font-medium text-neutral-900 dark:text-white">{t.mcpExpired}</span>
                      ) : (
                        <span className="text-neutral-500 dark:text-neutral-400">{formatDateTimeShort(tok.expiresAt)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => remove(tok.id)}
                        disabled={pending}
                        className="rounded-lg px-2.5 py-1 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
                      >
                        {t.delete}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}