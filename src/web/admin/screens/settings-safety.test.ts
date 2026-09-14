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
import { getSettings } from '@/content/settings'
import { saveIntegrationKeys } from '@/store/integration-keys'
import { settingsScreen } from './settings'

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
