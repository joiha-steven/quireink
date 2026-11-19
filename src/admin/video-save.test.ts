// A video line must survive open -> save, and a freshly inserted video must be written as its URL.
import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

async function open(source: string): Promise<string> {
  const { Editor } = await import('@/admin/editor/editor')
  const { videoUrlsToNodes } = await import('@/admin/components/editorDoc')
  const editor = new Editor({ element: document.createElement('div'), content: source })
  videoUrlsToNodes(editor)
  const out = editor.getMarkdown()
  const videos = (() => { let n = 0; editor.state.doc.descendants((x) => { if (x.type.name === 'video') n += 1 }); return n })()
  editor.destroy()
  return `${videos}|${out}`
}

describe('video lines survive a save', () => {
  it('keeps a self-hosted mp4 and a YouTube line, as players', async () => {
    const yt = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    const r = await open(`a\n\n/uploads/files/clip.mp4\n\n${yt}\n\nb`)
    expect(r.startsWith('2|')).toBe(true)
    expect(r).toContain('\n\n/uploads/files/clip.mp4\n\n')
    expect(r).toContain(`\n\n${yt}\n\n`)
  })
  it('a video inserted with setVideo is written as its URL on its own line', async () => {
    const { Editor } = await import('@/admin/editor/editor')
    const editor = new Editor({ element: document.createElement('div'), content: 'a\n\nb' })
    editor.chain().focus().setVideo('/uploads/files/new.webm').run()
    const md = editor.getMarkdown()
    editor.destroy()
    expect(md).toMatch(/(^|\n\n)\/uploads\/files\/new\.webm(\n\n|$)/)
  })
  it('leaves code, bold and a link to elsewhere as they are', async () => {
    for (const src of ['`/uploads/demo.mp4`', '**https://x.com/a.mp4**', '[https://x.com/a.mp4](https://x.com/page)']) {
      const r = await open(`x\n\n${src}\n\ny`)
      expect(r.startsWith('0|')).toBe(true)
    }
  })
  it('turns an autolinked bare mp4 into a player', async () => {
    expect((await open('x\n\nhttps://x.com/a.mp4\n\ny')).startsWith('1|')).toBe(true)
  })
})
