// The read-only tool list, pinned BY NAME — the same shape as `PUBLIC_WRITES` in
// `scripts/checks/routes-guarded.ts`. An unmarked tool is a write tool (fails safe: a
// read token merely cannot see it), so the only mistake worth a guard is the other one —
// marking something `readOnly` that writes. This list makes that a visible, reviewed act:
// widening it means editing a file whose whole content is this rule.
import { describe, it, expect } from 'bun:test'
import { collectTools } from '@/mcp/registry'

/** Every tool a 'read'-scope token may hold. Each really only reads: verified at review. */
const READ_ONLY = [
  'list_posts', 'get_post', 'search_posts', 'list_trashed_posts',
  'list_pages', 'get_page', 'list_trashed_pages',
  'list_categories', 'list_tags',
  'list_media', 'list_trashed_media', 'list_files', 'list_trashed_files',
  'get_settings',
  'get_traffic', 'get_post_traffic', 'get_audience', 'get_update_status', 'list_comments',
].sort()

describe('MCP tool scopes', () => {
  it('marks exactly the pinned tools readOnly — no more, no fewer', async () => {
    const tools = await collectTools()
    // The registry going empty would make both lists vacuously equal; forbid that first.
    expect(tools.length).toBeGreaterThan(30)
    const marked = tools.filter((t) => t.meta.readOnly).map((t) => t.name).sort()
    expect(marked).toEqual(READ_ONLY)
  })

  it('leaves every mutating name unmarked', async () => {
    // Belt to the pin's braces: any tool whose NAME says it writes must not carry the
    // mark, even if someone edits both this file's list and the tool in one commit.
    const tools = await collectTools()
    for (const t of tools.filter((t) => /^(create|update|delete|restore|patch|compose|send|reply|import|add|draft)/.test(t.name))) {
      expect(`${t.name}:${t.meta.readOnly ?? false}`).toBe(`${t.name}:false`)
    }
  })
})
