// The files list dates an upload in the admin's one short shape, on the site's day.
import { describe, expect, it } from 'bun:test'
import { adminT } from '@/i18n/admin-i18n'
import { filesPanel } from './media-files'
import { formatDateShort } from '@/admin-shared/when'
import type { FileItem } from '@/types'

const file: FileItem = {
  filename: 'menu.pdf', url: '/uploads/files/menu.pdf', size: 2048, contentType: 'application/pdf', uploadedAt: '2026-10-18T20:30:00.000Z',
}

describe('the files list', () => {
  it('prints the short date the rest of the admin prints, never the reader’s long one', () => {
    const html = filesPanel(adminT('en'), 'en', 'UTC', [file], [], true)
    expect(html).toContain(formatDateShort('2026-10-18', 'en'))
    expect(html).not.toContain('October')
  })

  it('takes the day from the site’s zone', () => {
    // 20:30 UTC on the 18th is already the 19th in Hanoi.
    const html = filesPanel(adminT('vi'), 'vi', 'Asia/Ho_Chi_Minh', [file], [], true)
    expect(html).toContain('19 thg 10, 2026')
  })
})
