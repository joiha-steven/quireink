// The callout label follows the piece's language; the body around it does not change (FIXLIST 8.1).
import { describe, expect, it } from 'bun:test'
import { renderPostContent } from '@/render/post-content'
import { t } from '@/i18n/i18n'
import { calloutWords } from '@/render/callout-words'

describe('calloutWords', () => {
  it('names each callout in the language asked for, and touches nothing else', async () => {
    const md = '> [!NOTE]\n> Read this.\n\n> [!CAUTION]\n> And this.\n\nA <b>Note</b> in prose.'
    const en = await renderPostContent({ markdown: md })
    expect(calloutWords(en, t('en'))).toBe(en)
    const ja = calloutWords(en, t('ja'))
    expect(ja).toContain(`<p class="callout-label">${t('ja').calloutNote}</p>`)
    expect(ja).toContain(`<p class="callout-label">${t('ja').calloutCaution}</p>`)
    expect(ja.replace(/<p class="callout-label">[^<]*<\/p>/g, '')).toBe(en.replace(/<p class="callout-label">[^<]*<\/p>/g, ''))
  })
})
