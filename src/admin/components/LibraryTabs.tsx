// The Library page as ONE SHEET (the admin-pages mock, 2026-08-17): the kind tabs on the
// sheet's first row, and — since 2026-08-31 — the images tab's own tools on that SAME row.
//
// It was two rows: tabs, then a band with a count, a search and a sort. The tab row carried
// three words and nothing else, so the second row existed only because the count lives in
// MediaLibrary's state while the tabs live here. Two chrome rows before a single picture is
// most of the fold on a laptop. The slot below is the images tab's landing place; videos and
// files have no tools of their own, so on those tabs the row is the tabs alone, as before.
//
// The non-default tabs mount lazily on first open.
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
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const tabs: TabItem<Tab>[] = [
    { key: 'images', label: t.tabImages },
    { key: 'videos', label: t.tabVideos },
    { key: 'files', label: t.tabFiles },
  ]

  return (
    <div className={SHEET}>
      <SheetTop>
        <Tabs tabs={tabs} value={tab} onChange={setTab} size="sm" />
        {/* A ref CALLBACK into state, not a ref object: the portal needs a re-render once
            the node exists, and `ref.current` filling in does not cause one. */}
        <div
          ref={setSlot}
          // Full width below `sm`, so on a phone it wraps to its own line under the tabs:
          // one row is the goal on a laptop and an impossibility beside a search box at
          // 390px, where forcing it ran the field off the sheet's right edge.
          className="flex w-full min-w-0 flex-wrap items-center gap-3 sm:w-auto sm:flex-1"
        />
      </SheetTop>
      {/* Keep the images tab mounted (it holds upload/scroll state); the videos and
          files tabs are created on first visit. */}
      <div className={tab === 'images' ? 'px-4 pt-4 pb-2' : 'hidden'}>
        {/* Null while another tab is showing: this stays mounted for its upload and scroll
            state, and a hidden tab must not put its tools in the visible row. */}
        <MediaLibrary mode="page" toolsSlot={tab === 'images' ? slot : null} />
      </div>
      {tab === 'videos' && <div className="px-4 pt-4 pb-2"><VideoLibrary /></div>}
      {tab === 'files' && <div className="px-4 pt-4 pb-2"><FileLibrary /></div>}
      {/* The page's old intro sentence, demoted to the sheet's closing small print —
          a hint is not a headline. */}
      <div className={SHEET_FOOT}>{t.libraryIntro}</div>
    </div>
  )
}
