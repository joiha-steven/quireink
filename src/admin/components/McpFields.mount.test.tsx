// Which grant the mint button actually asks for.
//
// The card carries two checkboxes and three scopes, and the mapping between them is the only
// place the owner expresses the decision in ADR 0051. A wrong default here would hand every
// new token the grant that lets it run script on the site's own origin, and nothing on the
// screen or in the network tab would look unusual — the request succeeds either way.
//
// So this asserts the BODY that goes to `/api/mcp/tokens`, not the look of the boxes.
import { describe, expect, it, beforeAll, afterAll, afterEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const restores: (() => void)[] = []
afterEach(() => { for (const r of restores.splice(0)) r() })

const MCP = { enabled: true }

/** The two scope boxes, in the order the card draws them: read-only, then custom code. */
const boxes = (c: HTMLElement) => [...c.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]

async function card() {
  const { mountAdmin, installFetchMock } = await import('@/admin/test-mount')
  const { McpFields } = await import('@/admin/components/McpFields')
  const { adminT } = await import('@/i18n/admin-i18n')
  const net = installFetchMock((url) =>
    url.startsWith('/api/mcp/tokens') ? { success: true, data: [] } : { success: true, data: {} })
  restores.push(net.restore)
  const m = await mountAdmin(
    <McpFields mcp={MCP} live siteUrl="https://blog.example" onChange={() => {}} />,
  )
  return { m, net, t: adminT('en') }
}

/**
 * Press Generate and answer the name dialog.
 *
 * The card asks for a name before it mints, so a test that only clicks the button proves
 * nothing: no request is made at all. Both the card's button and the dialog's carry the same
 * label, so the dialog's is found by taking the LAST match once it is open.
 */
async function mint(m: Awaited<ReturnType<typeof card>>['m'], label: string): Promise<void> {
  await m.click(m.button(label))
  const field = m.container.querySelector('input[type="text"], input:not([type])')
  if (field) await m.type(field, 'Claude desktop')
  const confirm = [...m.container.querySelectorAll('button')]
    .filter((b) => b.textContent?.trim() === label).at(-1)
  await m.click(confirm!)
  await m.flush()
}

/** The scope in the body of the last token-mint POST. */
const mintedScope = (calls: { url: string; method?: string; body?: unknown }[]): string | undefined =>
  (calls.filter((c) => c.method === 'POST' && c.url === '/api/mcp/tokens').at(-1)?.body as
    { scope?: string } | undefined)?.scope

describe('the scope a new MCP token is minted with', () => {
  it('asks for full when neither box is ticked, so an existing client keeps its writes', async () => {
    const { m, net, t } = await card()
    await mint(m, t.mcpGenerate)
    expect(mintedScope(net.calls)).toBe('full')
    await m.unmount()
  })

  it('asks for read when the read-only box is ticked', async () => {
    const { m, net, t } = await card()
    await m.click(boxes(m.container)[0]!)
    await mint(m, t.mcpGenerate)
    expect(mintedScope(net.calls)).toBe('read')
    await m.unmount()
  })

  it('asks for admin only when the custom-code box is ticked', async () => {
    const { m, net, t } = await card()
    await m.click(boxes(m.container)[1]!)
    await mint(m, t.mcpGenerate)
    expect(mintedScope(net.calls)).toBe('admin')
    await m.unmount()
  })

  it('disables custom code while read-only is on, rather than letting the two disagree', async () => {
    // "Reads nothing but may set custom head HTML" is not a grant anybody means, and a card
    // that lets both be ticked has to pick one silently. This picks in the markup instead.
    const { m } = await card()
    expect(boxes(m.container)[1]!.disabled).toBe(false)
    await m.click(boxes(m.container)[0]!)
    expect(boxes(m.container)[1]!.disabled).toBe(true)
    await m.unmount()
  })
})
