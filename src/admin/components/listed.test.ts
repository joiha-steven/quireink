// The piece the address bar names, for the write pane's selected row.
import { describe, expect, it } from 'bun:test'
import { pieceAtPath } from '@/admin/components/listed'

describe('pieceAtPath', () => {
  it('reads the three editors, and decodes the slug the bar encoded', () => {
    expect(pieceAtPath('/admin/editor/a-reed-pen')).toEqual({ kind: 'post', slug: 'a-reed-pen' })
    expect(pieceAtPath('/admin/page-editor/about')).toEqual({ kind: 'page', slug: 'about' })
    expect(pieceAtPath('/admin/note-editor/c%C3%A2y-s%E1%BA%ADy')).toEqual({ kind: 'note', slug: 'cây-sậy' })
    expect(pieceAtPath('/admin/editor/a-reed-pen?tab=meta')).toEqual({ kind: 'post', slug: 'a-reed-pen' })
  })

  it('names nothing on the Write screen, on a new editor, and on a slug that cannot be decoded', () => {
    expect(pieceAtPath('/admin/content')).toBeNull()
    expect(pieceAtPath('/admin/editor')).toBeNull()
    expect(pieceAtPath('/admin/editor/')).toBeNull()
    expect(pieceAtPath('/admin/editor/%E0%A4%A')).toBeNull()
    expect(pieceAtPath('/admin/settings')).toBeNull()
  })
})
