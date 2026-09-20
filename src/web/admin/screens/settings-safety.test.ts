// WHAT THE SETTINGS SCREEN MUST NEVER DO, asserted against the markup it actually sends.
//
// This screen drives the most dangerous routes in the admin: it changes the password, regenerates
// recovery codes, re-enrols the second factor, mints MCP tokens, deletes backups, bulk-imports
// content, purges a CDN and spends money on a vision model. Three rules keep that safe, and all
// three are properties of the MARKUP rather than of any handler:
//
//   1. NO `<form>`, and every `<button>` says `type="button"`. `ui/Button` emits a button with no
//      type and HTML's default is submit, so one form on this screen would let Enter in any field
//      fire whichever of those routes the nearest button belonged to.
//   2. NO SECRET IS EVER IN THE PAGE. `getIntegrationStatus()` turns every stored credential into
//      a boolean; a credential field ships EMPTY with a placeholder saying one is stored. Sending
//      the dots back would store the dots.
//   3. A CONTROL THAT DOES NOT STORE A SETTING CARRIES NO `data-k`. The form's diff saves every
//      `data-k` it finds, so a password box wearing one would be written into the settings record.
import { describe, it, expect, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { getSettings, saveSettings } from '@/content/settings'
import { saveIntegrationKeys } from '@/store/integration-keys'
import { settingsScreen } from './settings'
import { adminT } from '@/i18n/admin-i18n'

const DIR = './.tmp/test-settings-safety'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

/** THE WHOLE SCREEN, all seven tabs of it, drawn against real settings. */
const drawn = async (): Promise<string> =>
  settingsScreen(await getSettings(), new URLSearchParams())

describe('nothing on this screen can submit anything', () => {
  it('has no form at all', async () => {
    expect(await drawn()).not.toContain('<form')
  })

  it('says type="button" on every single button', async () => {
    const html = await drawn()
    const buttons = html.match(/<button\b[^>]*>/g) ?? []
    expect(buttons.length).toBeGreaterThan(20)
    expect(buttons.filter((b) => !b.includes('type="button"'))).toEqual([])
  })

  it('holds no input inside anything that could post', async () => {
    const html = await drawn()
    expect(html).not.toContain('<form')
    expect(html).toContain('<input')
  })
})

describe('no secret is ever in the page', () => {
  it('sends a stored API key as a boolean, never as its value', async () => {
    const secret = 'sk-do-not-ship-this-anywhere-1234567890'
    await saveIntegrationKeys({ aiProvider: 'anthropic', aiApiKey: secret, aiModel: 'a-model' })
    try {
      const html = await drawn()
      expect(html).not.toContain(secret)
      // Nor any fragment of it long enough to be one.
      expect(html).not.toContain(secret.slice(0, 12))
    } finally {
      await saveIntegrationKeys({ aiProvider: '', aiApiKey: '', aiModel: '' })
    }
  })

  it('never prints a password, a hash, a token or a recovery code', async () => {
    const html = await drawn()
    for (const smell of ['password_hash', 'totp_secret', 'recovery_code', 'mcp_token']) {
      expect(html).not.toContain(smell)
    }
    // A credential box is empty and typed as one, so a browser never offers to remember it as
    // the site's own password.
    for (const field of html.match(/<input[^>]*type="password"[^>]*>/g) ?? []) {
      expect(field).toMatch(/value=""|(?!.*value=)/)
    }
  })
})

describe('every hidden setting can be seen to change', () => {
  it('draws all of them with a baseline', async () => {
    // ⚠️ An `input[type=hidden]` keeps `value` and `defaultValue` in lockstep: setting `.value`
    // writes the content attribute too. A diff that reads `defaultValue` therefore reports a
    // chosen logo as unchanged and sends nothing — the picture on screen and the record
    // disagreeing with nothing saying so. `data-was` is what a hidden field answers with
    // instead, and five settings ride one: both logos, the portrait, `enabledPalettes` and
    // `customFont`.
    const html = await drawn()
    const hidden = html.match(/<input type="hidden"[^>]*data-k="[^"]+"[^>]*>/g) ?? []
    expect(hidden.length).toBeGreaterThan(3)
    expect(hidden.filter((f) => !f.includes('data-was='))).toEqual([])
  })
})

describe('only a setting wears a setting name', () => {
  it('keeps `data-k` off every control that stores no setting', async () => {
    const html = await drawn()
    // A password box, a one-time code box and an "add a row" picker all store nothing. If one
    // carried `data-k`, the form's diff would write it into the settings record on the next save.
    const risky = html.match(/<input[^>]*(?:type="password"|autocomplete="one-time-code")[^>]*>/g) ?? []
    for (const field of risky) expect(field).not.toContain('data-k=')
  })

  it('never ships two contradictory answers to one question', async () => {
    // ⚠️ ONE SETTING CAN BE DRAWN TWICE, on purpose: the comments master switch is on Posts
    // ("should there be comments") and on Comments & mail ("how do readers answer back"), which
    // is how React had it — one component, one piece of state, both tabs. What must never
    // happen is two copies ARRIVING with different values, because then the page is already
    // lying before anybody touches it and the form's diff sends whichever it walks into first.
    // The island keeps them in step from there (`mirror` in `settings-controls.ts`).
    const html = await drawn()
    const held = new Map<string, string>()
    const clash: string[] = []
    // A switch carries its value in `data-was`; every other control in `value` or `selected`.
    for (const m of html.matchAll(/data-k="([^"]+)"[^>]*?data-was="([^"]*)"/g)) {
      const [, k = '', was = ''] = m
      if (held.has(k) && held.get(k) !== was) clash.push(k)
      held.set(k, was)
    }
    expect(clash).toEqual([])
    expect(held.size).toBeGreaterThan(10)
  })
})

// A LAMP MAY NOT CLAIM A REPLY THE SERVER NEVER ASKED FOR (2026-09-20).
//
// `connectionOk` reads "Saved, and the far end answered". Four cards printed it because a
// SWITCH was on — the read-only API, the fediverse, the MCP server and scheduled backups, none
// of which has a far end at all — and three more printed it because a credential was stored,
// which `getIntegrationStatus` computes as `!!key` and never as "something replied". Measured
// on a seeded blog: the MCP card was green and saying the far end had answered while
// `mcp_tokens` held nothing and no request had ever been made.
//
// Nothing the SERVER draws can know that a far end answered — no test result is persisted
// anywhere, so the sentence is only ever true in the island, in the moment a test route comes
// back. That is the rule this asserts, and it is one string in one document.
describe('what a lamp may say about a far end', () => {
  const t = adminT('en')
  /**
   * Every lamp's own tag, which is where its sentence lives.
   *
   * ⚠️ NOT THE WHOLE DOCUMENT. `connectionOk` is legitimately IN the page — the island is
   * handed the whole dictionary in `data-settings-words`, because it is the one thing that may
   * print that sentence once a test route has answered. A first cut asserted the string was
   * absent from the page and failed on the dictionary, which would have been the wrong fix.
   */
  const lamps = (html: string): string[] => html.match(/<[^>]*data-card-lamp[^>]*>/g) ?? []

  it('never claims a reply on a lamp the server drew', async () => {
    const html = await drawn()
    expect(lamps(html).length).toBeGreaterThan(4)
    expect(lamps(html).filter((l) => l.includes(t.connectionOk))).toEqual([])
  })

  /**
   * ⚠️ EACH CARD SWITCHED ON AND COUNTED SEPARATELY, because a fresh blog has all four of these
   * switched OFF and an off lamp says `connectionOff`. A first cut asserted only that the
   * sentence appeared SOMEWHERE on the screen: the backup schedule is the one thing on by
   * default, so it satisfied the assertion by itself and putting the old claim back on the
   * other three left this green. Five of seven mutations survived.
   */
  const lampCount = (html: string, sentence: string): number =>
    lamps(html).filter((l) => l.includes(sentence)).length

  it('says a card with no far end is simply on, each of the four', async () => {
    const before = await drawn()
    // The backup schedule ships on, so it is already saying it.
    expect(lampCount(before, t.connectionOn)).toBe(1)

    await saveSettings({ api: { enabled: true } } as never)
    expect(lampCount(await drawn(), t.connectionOn)).toBe(2)

    await saveSettings({ mcp: { enabled: true } } as never)
    expect(lampCount(await drawn(), t.connectionOn)).toBe(3)

    await saveSettings({
      siteUrl: 'https://example.com',
      activitypub: { enabled: true, handle: 'blog' },
    } as never)
    expect(lampCount(await drawn(), t.connectionOn)).toBe(4)

    // And not one of the four has claimed anybody answered it.
    expect(lamps(await drawn()).filter((l) => l.includes(t.connectionOk))).toEqual([])
  })

  it('hands the island the sentence a card with no far end needs', async () => {
    // ⚠️ THE WIRE, not the lamp. `goodTitle` falls back to '' for a word the dictionary is
    // missing, so dropping `connectionOn` from `settings.ts` would empty every lamp the island
    // repaints and no other assertion here would notice: the server's own markup is unchanged.
    const words = (await drawn()).match(/data-settings-words="([^"]*)"/)?.[1] ?? ''
    expect(words).toContain('connectionOn')
    expect(words).toContain('connectionOk')
    expect(words).toContain('connectionUntested')
  })

  it('says a far end with no credentials is not set up, rather than saved', async () => {
    const html = await drawn()
    // ⚠️ THE COUNTER-TEST, and the reason this `it` exists apart from the one above: the amber
    // lamp used to read "Saved, but not tried yet" on a card where nothing had been saved. Both
    // sentences are honest somewhere, so asserting only that the page HAS an amber lamp would
    // pass on either of them.
    expect(lamps(html).some((l) => l.includes(t.connectionUnset))).toBe(true)
    expect(lamps(html).some((l) => l.includes(t.connectionUntested))).toBe(false)
  })

  it('says a stored credential is saved and untried, not answered — each far end', async () => {
    // Counted per card again, and for the same reason: three of these live on one screen, so
    // "the sentence is somewhere" is satisfied by whichever one happens to be configured.
    await saveIntegrationKeys({ cloudflareApiToken: 'tok', cloudflareZoneId: 'zone' })
    expect(lampCount(await drawn(), t.connectionUntested)).toBe(1)

    await saveIntegrationKeys({ s3Bucket: 'b', s3AccessKeyId: 'k', s3SecretAccessKey: 's' })
    expect(lampCount(await drawn(), t.connectionUntested)).toBe(2)

    // The AI card is `off` until a provider is named, and `off` is its own sentence.
    await saveIntegrationKeys({ aiProvider: 'anthropic', aiApiKey: 'k' })
    expect(lampCount(await drawn(), t.connectionUntested)).toBe(3)

    // The comment card only has a far end when Turnstile is asked for.
    await saveSettings({ comments: { enabled: true, turnstile: true } } as never)
    await saveIntegrationKeys({ turnstileSecretKey: 'sk', turnstileSiteKey: 'pk' })
    expect(lampCount(await drawn(), t.connectionUntested)).toBe(4)

    // Not one of the four claims a reply, with every credential on the machine stored.
    expect(lamps(await drawn()).filter((l) => l.includes(t.connectionOk))).toEqual([])
  })
})

describe('every id on the screen is its own', () => {
  it('has no duplicate id, which a label would resolve to the wrong control', async () => {
    // ⚠️ ALL SEVEN TABS SHIP IN ONE DOM (ADR 0054), so two controls drawn on two tabs are two
    // elements on one page. `comments.enabled` is drawn twice on purpose — beside the posts it
    // affects and beside the card about the people who use it — and shared one id until
    // 2026-09-21: invalid HTML, and a `for` resolves to the FIRST match, so the People tab's
    // label pointed at the Posts tab's switch and clicking it moved the wrong thing.
    const html = await drawn()
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!)
    const seen = new Set<string>()
    const twice = ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)))
    expect({ duplicates: [...new Set(twice)] }).toEqual({ duplicates: [] })
    // The counter-test: the same search actually found ids to check.
    expect(ids.length).toBeGreaterThan(50)
  })
})
