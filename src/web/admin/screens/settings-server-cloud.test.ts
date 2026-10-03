// The Cloudflare card on a blog made with the Deploy button (`workflowStep`): the copy Cloudflare makes
// has no `.github/workflows`, so the card has to hand the owner the file. Drawn for every update
// path and shown by the island for `git` only (`data-cf-path`), with the release's file inside it.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { cloudCard } from './settings-server-cloud'
import { adminT } from '@/i18n/admin-i18n'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { UPDATE_WORKFLOW } from '@/install/cloudflare/update-workflow'

const before = process.env.QUIREINK_PACKAGE
beforeAll(() => { process.env.QUIREINK_PACKAGE = 'cloudflare' })
afterAll(() => { if (before === undefined) delete process.env.QUIREINK_PACKAGE; else process.env.QUIREINK_PACKAGE = before })

const decode = (html: string): string =>
  html.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')

describe('the workflow step on a Deploy-button blog', () => {
  it('sits in the git path\'s block, carrying the release\'s file whole', () => {
    const html = cloudCard(adminT('en'), { ...DEFAULT_SETTINGS })
    expect(html).toContain('data-cf-path="git" data-cf-wf hidden')
    const pre = /<pre data-cf-wf-file[^>]*>([\s\S]*?)<\/pre>/.exec(html)?.[1] ?? ''
    expect(decode(pre)).toBe(UPDATE_WORKFLOW)
    // No copy named yet: the links are drawn and hidden, for the island to fill.
    expect(/<a data-cf-wf-open href="#"[^>]* hidden>/.test(html)).toBe(true)
  })

  it('links the named copy\'s new-file page and its Actions when the copy is known', () => {
    const html = cloudCard(adminT('en'), { ...DEFAULT_SETTINGS, sourceRepo: 'jane/blog' })
    const href = decode(/<a data-cf-wf-open href="([^"]*)"/.exec(html)?.[1] ?? '')
    expect(href.startsWith('https://github.com/jane/blog/new/main?filename=.github/workflows/update-quireink.yml&value=')).toBe(true)
    expect(new URL(href).searchParams.get('value')).toBe(UPDATE_WORKFLOW)
    expect(html).toContain('href="https://github.com/jane/blog/actions"')
    expect(html).toContain('value="jane/blog"')
  })
})
