// Invariant 4, enforced: every write route is mounted on the owner-gated router group.
//
// `web/guard.ts` makes the gate structural — a route on an `ownerRouter()` is protected
// because of where it lives. This check is the other half: it makes mounting a write route
// somewhere ELSE a build failure rather than a thing to notice in review.
//
// The frozen tree had the same check for the same reason, and it earned its place: a
// per-handler `requireOwner()` is a line, and a line can be left out.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'src/web'
const WRITE_METHODS = ['post', 'put', 'patch', 'delete'] as const

/**
 * Write routes that are PUBLIC on purpose. Each one is a reader doing something, not an
 * owner, and each is defended by its own means (rate limiting, a signed token, Turnstile).
 *
 * Adding to this list should feel like a decision. That is the point of it being a list
 * rather than a naming convention.
 */
const PUBLIC_WRITES = new Map<string, string>([
  ['/api/track', 'the analytics beacon; every reader\'s browser calls it. Rate limited, bots dropped, no PII stored.'],
  ['/api/comments', 'a reader leaving a comment. Rate limited and Turnstile-gated.'],
  ['/comment-auth/signout', 'a reader dropping their commenter cookie. It clears unconditionally, so a forged call signs someone out and can do nothing else.'],
  ['/api/subscribe', 'a reader joining the newsletter. Double opt-in, so a forged call sends one confirmation mail and nothing else.'],
  ['/api/newsletter/unsubscribe', 'the POST half of unsubscribe. The token in the link is the authorisation.'],
  ['/api/auth/login', 'the sign-in form. Cannot require a session to create one.'],
  ['/api/auth/2fa', 'the second factor. Authorised by the pending ticket from the step before.'],
  ['/api/auth/enrol', 'first-run TOTP enrolment. Same pending ticket.'],
  ['/api/auth/enrol/done', 'acknowledging the recovery codes, which is where the first session is issued. Requires a ticket whose enrolment actually completed.'],
  ['/api/auth/logout', 'ending a session. Refusing this to an expired session would be perverse.'],
  ['/api/cron', 'called by an external scheduler that has no session. Authorised by CRON_SECRET as a bearer token when one is set.'],
  ['/api/mcp/register', 'RFC 7591 dynamic client registration, which happens BEFORE any auth by definition. Rate limited per IP, refused while MCP is off, and registering a client grants nothing on its own - the owner still has to approve it at /api/mcp/authorize.'],
  ['/api/mcp/token', 'the OAuth token exchange. Authorised by a signed, single-use, PKCE-bound code rather than a session.'],
  ['/api/mcp', 'the MCP endpoint itself. Authorised by a bearer token the owner minted, not by the session cookie, and it must answer 401 with the resource-metadata pointer that starts the OAuth flow rather than the plain refusal the gate would give. Refused outright while MCP is off.'],
  ['/api/mcp/authorize', 'the consent form POST. Requires an owner session AND a session-bound CSRF token; it is listed here only because the GET half must be reachable to sign in from.'],
])

type Finding = { file: string; line: number; method: string; path: string }

const findings: Finding[] = []
let guardedRouters = 0

function scan(file: string): void {
  const source = readFileSync(file, 'utf8')
  const lines = source.split('\n')

  // Identifiers holding a GATED router. `ownerRouter()` applies `requireOwner()` at
  // construction, so anything assigned from it is protected by definition.
  const gated = new Set<string>()
  for (const match of source.matchAll(/(?:const|let)\s+(\w+)\s*(?::[^=]+)?=\s*ownerRouter\(\)/g)) {
    gated.add(match[1])
    guardedRouters += 1
  }

  lines.forEach((line, index) => {
    for (const method of WRITE_METHODS) {
      // `app.post('/path', ...)`. Only a literal path is matched: a computed one cannot be
      // checked here, and none exist — if one appears, this silently ignoring it would be
      // the wrong outcome, so the loop below reports that case separately.
      // The literal must LOOK like a route: Hono paths start with `/` (or are `*`). Without
      // that, `headers.delete('content-length')` in the compression middleware was reported
      // as an ungated DELETE route — a guard that cries wolf is a guard that gets switched
      // off, and this one is load-bearing.
      const match = line.match(new RegExp(`\\b(\\w+)\\.${method}\\(\\s*(['\`])([/*][^'\`]*)\\2`))
      if (match === null) continue
      const [, receiver, , path] = match
      if (gated.has(receiver)) continue
      if (PUBLIC_WRITES.has(path)) continue
      findings.push({ file, line: index + 1, method: method.toUpperCase(), path })
    }
  })
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return walk(path)
    // `.test.ts` files mount routes to prove the gate WORKS, including unguarded ones.
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : []
  })
}

for (const file of walk(DIR)) scan(file)

if (findings.length > 0) {
  console.error('✗ check:routes-guarded: write routes outside the owner-gated group')
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  ${f.method} ${f.path}`)
  }
  console.error('')
  console.error('  Mount it on an ownerRouter() (see src/web/guard.ts), or — if it is')
  console.error('  genuinely public — add it to PUBLIC_WRITES in this file WITH the reason.')
  process.exit(1)
}

console.log(`✓ check:routes-guarded: ok (${guardedRouters} gated router(s), ${PUBLIC_WRITES.size} declared public)`)
