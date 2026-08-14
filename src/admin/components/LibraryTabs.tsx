// Three-tab shell for the Library page: "Images" (the media library), "Videos"
// (video attachments with players), and "Files" (the other attachments). The
// non-default tabs mount lazily on first open.
import { useState } from 'react'
import { MediaLibrary } from './MediaLibrary'
import { VideoLibrary } from './VideoLibrary'
import { FileLibrary } from './FileLibrary'
import { GROUP_GAP, type TabItem, Tabs } from './kit'
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
    <div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} className={GROUP_GAP} />
      {/* Keep the images tab mounted (it holds upload/scroll state); the videos and
          files tabs are created on first visit. */}
      <div className={tab === 'images' ? '' : 'hidden'}>
        <MediaLibrary mode="page" />
      </div>
      {tab === 'videos' && <VideoLibrary />}
      {tab === 'files' && <FileLibrary />}
    </div>
  )
}
