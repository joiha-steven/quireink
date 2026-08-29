// The tool surface as a NEUTRAL list, so it can have more than one door.
//
// Every tool file registers against `ToolHost` — a one-method interface the real
// `McpServer` satisfies structurally — instead of against McpServer itself. That one
// change is the whole trick: the MCP transport keeps calling `registerTools(server)`
// exactly as before, and anything else (the in-admin assistant this exists for) calls
// `collectTools()` to get the same tools as plain data — name, description, zod shape,
// handler — and drives them through its own provider's tool-calling dialect.
//
// One list, many doors, ONE rulebook: a tool absent here (the newsletter broadcast, the
// token mint) is absent from every door at once, which is what keeps the security story
// reviewable. Do not let a door grow a private tool.

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { z } from 'zod'

export type ToolMeta = {
  description: string
  inputSchema?: Record<string, z.ZodType>
  /**
   * Declares a tool safe for a 'read'-scope token. UNMARKED MEANS WRITE: a new tool
   * someone forgets to classify is withheld from read tokens, which is an inconvenience
   * — the failure mode of marking-the-writes would be a breach. The full read list is
   * pinned by `scope.test.ts`, so widening it is a visible, reviewed act.
   */
  readOnly?: true
}

// Generic exactly the way the SDK's own registerTool is, so a handler keeps its typed,
// destructurable args — the whole reason the tool files did not need a single body edit.
export type ToolHost = {
  registerTool<S extends Record<string, z.ZodType>>(
    name: string,
    meta: { description: string; inputSchema?: S; readOnly?: true },
    handler: (args: { [K in keyof S]: z.infer<S[K]> }) => Promise<CallToolResult> | CallToolResult,
  ): void
}

export type ToolDef = {
  name: string
  meta: ToolMeta
  handler: (args: Record<string, unknown>) => Promise<CallToolResult> | CallToolResult
}

/** Every tool, as data. The import is lazy to keep the circle open: tools import this
 *  file's TYPES, this function imports their registrations. */
export async function collectTools(): Promise<ToolDef[]> {
  const { registerTools } = await import('@/mcp/tools')
  const list: ToolDef[] = []
  registerTools({
    registerTool(name, meta, handler) {
      list.push({ name, meta, handler: handler as ToolDef['handler'] })
    },
  })
  return list
}
