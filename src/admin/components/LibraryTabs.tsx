// The Library page as ONE SHEET (the admin-pages mock, 2026-08-17): the kind tabs on
// the sheet's first row, the tab's own toolbar as the second — the editor's two-row
// chrome, worn by a library. The non-default tabs mount lazily on first open.
import { useState } from 'react'
import { MediaLibrary } from './MediaLibrary'
import { VideoLibrary } from './VideoLibrary'
import { FileLibrary } from './FileLibrary'
import { type TabItem, Tabs } from './kit'
import { SHEET, SHEET_FOOT, SheetTop } from './sheet'
import { useAdminT } from './I18nProvider'

type Tab = 'images' | 'videos' | 'files'

export function LibraryTabs() {
  const t = useAdminT()
  const [tab, setTab] = useState<Tab>('images')
  const tabs: TabItem<Tab>[] = [
    { key: 'images', label: t.tabImages },
    { key: 'videos', label: t.tabVideos },
    { key: 'files', label: t.tabFiles },
  ]

  return (
    <div className={SHEET}>
      <SheetTop>
        <Tabs tabs={tabs} value={tab} onChange={setTab} size="sm" />
      </SheetTop>
      {/* Keep the images tab mounted (it holds upload/scroll state); the videos and
          files tabs are created on first visit. */}
      <div className={tab === 'images' ? 'px-4 pt-4 pb-2' : 'hidden'}>
        <MediaLibrary mode="page" />
      </div>
      {tab === 'videos' && <div className="px-4 pt-4 pb-2"><VideoLibrary /></div>}
      {tab === 'files' && <div className="px-4 pt-4 pb-2"><FileLibrary /></div>}
      {/* The page's old intro sentence, demoted to the sheet's closing small print —
          a hint is not a headline. */}
      <div className={SHEET_FOOT}>{t.libraryIntro}</div>
    </div>
  )
}
