// The workflow a Deploy-button blog is told to add (`workflowStep`, settings-server-cloud.ts) must be
// the release's own, byte for byte: a copy that drifted would install an older update path into
// every copy that took it. And the link that carries it has a length GitHub and browsers accept.
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { UPDATE_WORKFLOW } from './update-workflow'
import { actionsUrl, newWorkflowUrl, readRepo, WORKFLOW_PATH } from '@/admin-shared/source-repo'

const ROOT = join(import.meta.dir, '..', '..', '..')

describe('the update workflow a button blog adds', () => {
  it('is the release\'s .github/workflows/update-quireink.yml, byte for byte', () => {
    expect(UPDATE_WORKFLOW).toBe(readFileSync(join(ROOT, WORKFLOW_PATH), 'utf8'))
  })

  it('travels whole in the new-file link, under 8,000 characters even for the longest names', () => {
    const longest = `${'a'.repeat(39)}/${'b'.repeat(100)}`
    const url = newWorkflowUrl(longest, UPDATE_WORKFLOW)
    expect(url.length).toBeLessThan(8000)
    const value = new URL(url).searchParams.get('value')
    expect(value).toBe(UPDATE_WORKFLOW)
    expect(new URL(url).searchParams.get('filename')).toBe(WORKFLOW_PATH)
    expect(actionsUrl('jane/blog')).toBe('https://github.com/jane/blog/actions')
  })
})

describe('reading the copy\'s name', () => {
  it('takes owner/name however it was pasted', () => {
    for (const typed of ['jane/blog', ' jane/blog ', 'https://github.com/jane/blog', 'https://github.com/jane/blog/', 'github.com/jane/blog.git', 'git@github.com:jane/blog.git']) {
      expect(readRepo(typed)).toBe('jane/blog')
    }
  })

  it('refuses what cannot be a GitHub repository', () => {
    for (const typed of ['', 'jane', 'jane/', '/blog', 'jane/blog/extra', '-jane/blog', 'jane/..', 'ja ne/blog', `${'a'.repeat(40)}/blog`, 'https://gitlab.com/jane/blog']) {
      expect(readRepo(typed)).toBeNull()
    }
  })
})
