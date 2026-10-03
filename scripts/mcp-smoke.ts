// MCP, end to end, against a running blog with an owner (ADR 0065: every feature on every package).
//
//   QUIRE_SESSION=<owner cookie value> bun scripts/mcp-smoke.ts <url>
//
// What a client does, over the wire, with a token minted the way Settings → Advanced mints one:
// initialize, list the tools, write a post, read it back, trash it. Then a `read` token, whose
// tool list must not contain a write tool at all. Everything it makes it removes — the post from
// the trash, both tokens — so running it twice measures the same blog twice.
//
// Why a script and not a unit test: `admin-mcp.test.ts` proves the routes under Bun's test runner.
// This proves the SDK, the transport and the tools under whatever runtime and package the blog was
// installed with. On Cloudflare that is a Worker that may not compile code from strings — the
// SDK constructs Ajv on every request, and only an `outputSchema` or an elicitation would make it
// compile one (G3.5).

const BASE = (process.argv[2] ?? '').replace(/\/+$/, '')
const SESSION = process.env.QUIRE_SESSION ?? ''
if (!BASE || !SESSION) {
  console.error('usage: QUIRE_SESSION=<owner cookie> bun scripts/mcp-smoke.ts <url>')
  process.exit(2)
}
// `__Host-`-prefixed: the name has to match exactly or the request is anonymous (restore-check.ts).
const OWNER = { cookie: `__Host-quire_session=${SESSION}`, origin: BASE, 'content-type': 'application/json' }

const failures: string[] = []
const say = (ok: boolean, line: string) => {
  console.log(`  ${ok ? '✓' : '✗'} mcp: ${line}`)
  if (!ok) failures.push(line)
}

async function mint(name: string, scope: 'full' | 'read'): Promise<{ token: string; id: number } | null> {
  const res = await fetch(`${BASE}/api/mcp/tokens`, { method: 'POST', headers: OWNER, body: JSON.stringify({ name, scope }) })
  if (res.status !== 201) return null
  // The admin envelope (`web/api.ts`): `{ success, data }`.
  const { data } = (await res.json()) as { data: { token: string; info: { id: number } } }
  return { token: data.token, id: data.info.id }
}

let nextId = 1
type Reply = { result?: Record<string, unknown>; error?: { message: string } }
async function rpc(token: string, method: string, params: Record<string, unknown> = {}): Promise<Reply> {
  const res = await fetch(`${BASE}/api/mcp`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
  })
  if (!res.ok) return { error: { message: `HTTP ${res.status}` } }
  return (await res.json()) as Reply
}

/** A tool's answer: its text, and whether the tool itself reported an error. */
async function call(token: string, name: string, args: Record<string, unknown>): Promise<{ text: string; isError: boolean }> {
  const reply = await rpc(token, 'tools/call', { name, arguments: args })
  if (reply.error) return { text: reply.error.message, isError: true }
  const content = (reply.result?.content ?? []) as { type: string; text?: string }[]
  return { text: content.map((c) => c.text ?? '').join(''), isError: reply.result?.isError === true }
}

const toolNames = async (token: string): Promise<string[]> =>
  (((await rpc(token, 'tools/list')).result?.tools ?? []) as { name: string }[]).map((t) => t.name)

// THE OWNER'S SWITCH, turned on for the run and put back after: off, `/api/mcp` is a 404 by
// design (`mcp-transport.ts`) and on, an unauthenticated call is a 401 — which is how this reads
// the state it found without a settings route to ask. A smoke that left it on would have changed
// the blog it checked.
const doorBefore = await fetch(`${BASE}/api/mcp`, { method: 'POST' }).then((r) => r.status, () => 0)
say(doorBefore === 404 || doorBefore === 401, `the MCP door answers ${doorBefore} before the run (404 off, 401 on)`)
const wasOff = doorBefore === 404
const switchMcp = (enabled: boolean) =>
  fetch(`${BASE}/api/settings`, { method: 'PUT', headers: OWNER, body: JSON.stringify({ mcp: { enabled } }) }).then((r) => r.ok, () => false)
if (wasOff) say(await switchMcp(true), 'the owner switches MCP on')

const stamp = Date.now().toString(36)
const full = await mint(`mcp-smoke ${stamp}`, 'full')
say(full !== null, 'the owner mints a token')
const read = await mint(`mcp-smoke read ${stamp}`, 'read')
say(read !== null, 'the owner mints a read token')

let slug = ''
if (full) {
  const init = await rpc(full.token, 'initialize', {
    protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'mcp-smoke', version: '1' },
  })
  const server = (init.result?.serverInfo as { name?: string } | undefined)?.name
  say(server === 'quire', `initialize answers as ${server ?? init.error?.message ?? 'nothing'}`)

  const names = await toolNames(full.token)
  say(names.includes('create_post') && names.includes('get_post'), `tools/list gives ${names.length} tools, the post tools among them`)

  const title = `MCP smoke ${stamp}`
  const made = await call(full.token, 'create_post', { title, content: 'Written over MCP by `scripts/mcp-smoke.ts`.' })
  try { slug = (JSON.parse(made.text) as { slug?: string }).slug ?? '' } catch { /* reported below */ }
  say(!made.isError && slug !== '', `create_post writes a draft${made.isError ? `: ${made.text.slice(0, 120)}` : ''}`)

  if (slug) {
    const got = await call(full.token, 'get_post', { slug })
    say(!got.isError && got.text.includes(title), 'get_post reads it back')
    const gone = await call(full.token, 'delete_post', { slug })
    say(!gone.isError, 'delete_post moves it to the trash')
  }
}

if (read) {
  const names = await toolNames(read.token)
  say(names.includes('list_posts') && !names.includes('create_post'), `a read token sees ${names.length} tools and no write tool`)
}

// Leave the blog as it was found, whatever failed above.
if (slug) {
  await fetch(`${BASE}/api/trash`, {
    method: 'POST', headers: OWNER, body: JSON.stringify({ kind: 'posts', action: 'purge', ids: [slug], force: true }),
  }).catch(() => undefined)
}
for (const t of [full, read]) {
  if (t) await fetch(`${BASE}/api/mcp/tokens/${t.id}`, { method: 'DELETE', headers: OWNER }).catch(() => undefined)
}
if (wasOff) say(await switchMcp(false), 'the MCP switch is put back off')

if (failures.length) {
  console.log(`✗ mcp-smoke: ${failures.length} failed`)
  process.exit(1)
}
console.log('✓ mcp-smoke: ok')
