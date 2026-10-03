// The upgrade a screen tells its owner to run is the one THIS install upgrades with (ADR 0065):
// `bun run upgrade` handed to a Docker owner would fail, or build a second copy beside the
// container. And none of it is drawn unless there is something newer to upgrade to.
import { describe, it, expect, afterEach } from 'bun:test'
import { installCard, type UpdateStatus } from '@/web/admin/screens/settings-server-ops'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { adminT } from '@/i18n/admin-i18n'

const t = adminT('en')
const behind: UpdateStatus = {
  blockedBy: null,
  update: { state: 'behind', release: { latest: '9.9.9', url: 'https://example.org/r', date: '2026-10-03' } },
}
const previous = process.env.QUIREINK_PACKAGE

afterEach(() => {
  if (previous === undefined) delete process.env.QUIREINK_PACKAGE
  else process.env.QUIREINK_PACKAGE = previous
})

function card(pkg: string, u: UpdateStatus = behind): string {
  process.env.QUIREINK_PACKAGE = pkg
  return installCard(t, DEFAULT_SETTINGS, u)
}

describe('how to upgrade', () => {
  it('gives a source install bun run upgrade, and nothing for an image', () => {
    const html = card('source')
    expect(html).toContain(t.updateHowSource)
    expect(html).toContain('bun run upgrade')
    expect(html).not.toContain('docker compose pull')
  })

  it('gives an image install the pull, and nothing for a checkout', () => {
    const html = card('docker')
    expect(html).toContain('docker compose pull &amp;&amp; docker compose up -d')
    expect(html).not.toContain('bun run upgrade')
  })

  it('gives a Cloudflare install words, because there is no command to type', () => {
    const html = card('cloudflare')
    expect(html).toContain(t.updateHowCloudflare)
    expect(html).not.toContain('<code')
  })

  it('says nothing about upgrading when there is nothing newer', () => {
    expect(card('source', { blockedBy: null, update: { state: 'current' } })).not.toContain(t.updateHowLabel)
  })
})
