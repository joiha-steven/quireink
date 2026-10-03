// The port contracts, run INSIDE workerd (ADR 0066, rule 3). `bun run test:cf` builds this with
// `scripts/build-worker.ts`, serves it with `wrangler dev --local`, and asks it to run each suite.
// Every case gets a Durable Object of its own, so each one starts from an empty database exactly as
// the Bun side's cases each start from a new file.
import { DurableObject } from 'cloudflare:workers'
import { bind, type CfEnv } from '@/runtime/cf/bindings'
import { open } from '@/runtime/cf/db'
import { dbContract } from '@/runtime/db.contract'
import { hash as cfHash, verify as cfVerify } from '@/runtime/cf/password'
import { regexEngine } from '@/runtime/cf/shiki-engine'

type Case = { name: string; body: () => void }

/** The cases a suite registers, collected rather than run, so one object runs exactly one. */
function collect(): Case[] {
  const cases: Case[] = []
  dbContract((name, body) => cases.push({ name, body }), () => open('contract.db', 'NORMAL'))
  return cases
}

export class Probe extends DurableObject<CfEnv> {
  constructor(ctx: DurableObjectState, env: CfEnv) {
    super(ctx, env)
    bind(env, ctx)
  }

  override async fetch(request: Request): Promise<Response> {
    const index = Number(new URL(request.url).searchParams.get('case'))
    const c = collect()[index]
    if (!c) return Response.json({ error: `no case ${index}` }, { status: 404 })
    try {
      c.body()
      return Response.json({ name: c.name, ok: true })
    } catch (error) {
      return Response.json({ name: c.name, ok: false, error: String((error as Error).message ?? error) })
    }
  }
}

export default {
  async fetch(request: Request, env: CfEnv & { PROBE: DurableObjectNamespace }): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/cases') return Response.json(collect().map((c) => c.name))
    // G2.5: the two workloads that threaten 128 MB. `test:cf --memory` reads the isolate's heap around them.
    if (url.pathname === '/load/argon') {
      const h = await cfHash('a long enough passphrase', { memoryCost: 19456, timeCost: 2 })
      const old = '$argon2id$v=19$m=65536,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$' + 'A'.repeat(43)
      await cfVerify('a long enough passphrase', old)
      return Response.json({ ok: await cfVerify('a long enough passphrase', h) })
    }
    if (url.pathname === '/load/shiki') {
      const n = Number(url.searchParams.get('n') ?? 40)
      const shiki = await import('shiki')
      const h = await shiki.createHighlighter({ themes: ['vitesse-light'], langs: [], engine: regexEngine() })
      const langs = Object.keys(shiki.bundledLanguages).slice(0, n)
      for (const lang of langs) {
        await h.loadLanguage(lang as Parameters<typeof h.loadLanguage>[0])
        h.codeToHtml('x = 1', { lang, theme: 'vitesse-light' })
      }
      return Response.json({ loaded: langs.length })
    }
    const index = url.searchParams.get('case') ?? ''
    return env.PROBE.get(env.PROBE.idFromName(`case-${index}-${Date.now()}`)).fetch(request)
  },
}
