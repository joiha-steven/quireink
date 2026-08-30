// Settings → AI: the model and its automatic jobs, and the MCP door an agent connects
// through. One tab because the owner ruled AI and MCP one subject on 2026-08-23:
// everything a model does to this site starts here.
//
// Split from `SettingsView.tsx` the day it was born — adding the tab put that file one
// line over its 400-line ceiling, and the rule is split, not squeeze. Same seam as
// `SettingsSystemTab`: the state stays in `SettingsView`, this takes fields and hands
// back changes, so there is still ONE form and ONE save button for the settings half.
import type { SiteSettings } from '@/types'
import type { IntegrationStatus } from '@/store/integration-keys'
import { Card } from './kit'
import { useAdminT } from './I18nProvider'
import { AiFields } from './AiFields'
import { McpFields } from './McpFields'

export function SettingsAiTab(
  { s, update, integrations, grid, col }: {
    s: SiteSettings
    update: (partial: Partial<SiteSettings>) => void
    integrations: IntegrationStatus
    grid: string
    col: string
  },
) {
  const t = useAdminT()
  return (
    <div className={grid}>
      <div className={col}>
        <Card panel title={t.cardAi}>
          <AiFields
            configured={integrations.aiConfigured}
            provider={integrations.aiProvider}
            model={integrations.aiModel}
            seesImages={integrations.aiSeesImages}
            ai={s.ai}
            onChangeAi={(ai) => update({ ai })}
          />
        </Card>
      </div>
      <div className={col}>
        <Card panel title={t.cardMcp}>
          <McpFields mcp={s.mcp} siteUrl={s.siteUrl} onChange={(mcp) => update({ mcp })} />
        </Card>
      </div>
    </div>
  )
}
