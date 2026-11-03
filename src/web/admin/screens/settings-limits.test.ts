// The two storage limits say what the SERVER allows, as a number. The hints only said a file could
// be "as large as the server allows", and on Cloudflare that is 25 MB, which an owner met only as a
// refusal (2026-11-03).
import { afterAll, afterEach, describe, expect, it } from 'bun:test'
import { installCard, type UpdateStatus } from '@/web/admin/screens/settings-server-ops'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { adminT } from '@/i18n/admin-i18n'

const t = adminT('en')
const none: UpdateStatus = { blockedBy: null, update: { state: 'behind', release: { latest: '9.9.9', url: 'https://example.org/r', date: '2026-10-03' } } }
const saved = { pkg: process.env.QUIREINK_PACKAGE, mb: process.env.MAX_UPLOAD_MB }
afterEach(() => { delete process.env.MAX_UPLOAD_MB })
afterAll(() => {
  if (saved.pkg === undefined) delete process.env.QUIREINK_PACKAGE; else process.env.QUIREINK_PACKAGE = saved.pkg
  if (saved.mb !== undefined) process.env.MAX_UPLOAD_MB = saved.mb
})

describe('the largest upload', () => {
  it('names the 25 MB a Cloudflare install allows', () => {
    process.env.QUIREINK_PACKAGE = 'cloudflare'
    expect(installCard(t, DEFAULT_SETTINGS, none)).toContain(t.serverLimit.replace('{n}', '25 MB'))
  })
  it('names what the server was told, and says when it set none', () => {
    process.env.QUIREINK_PACKAGE = 'docker'
    process.env.MAX_UPLOAD_MB = '200'
    expect(installCard(t, DEFAULT_SETTINGS, none)).toContain(t.serverLimit.replace('{n}', '200 MB'))
    process.env.MAX_UPLOAD_MB = '0'
    expect(installCard(t, DEFAULT_SETTINGS, none)).toContain(t.serverNoLimit)
  })
})

// The 5 GB the store may hold applies on Cloudflare too, to R2, where there is no disk to fill, and
// nothing on the screen or in the Cloudflare guide said so (2026-11-03).
describe('the store\'s size', () => {
  it('names the 5 GB ceiling, on Cloudflare as elsewhere', () => {
    process.env.QUIREINK_PACKAGE = 'cloudflare'
    expect(installCard(t, DEFAULT_SETTINGS, none)).toContain(t.serverLimit.replace('{n}', '5 GB'))
  })
})
