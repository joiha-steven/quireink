import { McpFields } from 'quireink'
import { SETTINGS } from './_fixtures'

// The MCP panel prints the endpoint a client connects to, so it needs a real siteUrl to say
// anything useful.
export function Basic() {
  return <McpFields mcp={SETTINGS.mcp} siteUrl="https://quireink.com" onChange={() => {}} />
}

export function Enabled() {
  return (
    <McpFields
      mcp={{ ...SETTINGS.mcp, enabled: true }}
      siteUrl="https://quireink.com"
      onChange={() => {}}
    />
  )
}
