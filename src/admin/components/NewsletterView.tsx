// Admin → Newsletter shell: three tabs over the same audience. "People" is who is on
// the list and what they have been sent; "Send" picks a post, previews the real email
// and mails it; "Test" fires sample sends through the saved SMTP config.
import { useState } from 'react'
import Link from '@/admin/router'
import { PageHeader, type TabItem, Tabs } from './kit'
import { SHEET, SHEET_FOOT, SheetTop, SHEET_TOOL_ON_CANVAS } from './sheet'
import { useAdminT } from './I18nProvider'
import { NewsletterSubscribers } from './NewsletterSubscribers'
import { NewsletterSend, type SendablePost } from './NewsletterSend'
import { NewsletterTest } from './NewsletterTest'

type Tab = 'people' | 'send' | 'test'

export function NewsletterView({ posts, mailConfigured }: { posts: SendablePost[]; mailConfigured: boolean }) {
  const t = useAdminT()
  const [tab, setTab] = useState<Tab>('people')

  const TABS: TabItem<Tab>[] = [
    { key: 'people', label: t.nlTabPeople },
    { key: 'send', label: t.nlTabSend },
    { key: 'test', label: t.nlTabTest },
  ]

  return (
    // ONE SHEET (the admin-pages mock, page 4): tabs on the sheet's first row, the SMTP
    // warning as a full-width line under it, the page hint demoted to the closing line.
    <div>
      <PageHeader
        title={t.navNewsletter}
        actions={
          <Link href="/admin/settings?tab=connections" className={SHEET_TOOL_ON_CANVAS}>
            {t.nlSmtpSettingsLink} →
          </Link>
        }
      />
      <div className={SHEET}>
        <SheetTop>
          <Tabs tabs={TABS} value={tab} onChange={setTab} size="sm" />
        </SheetTop>
        {/* One banner, not one per tab: nothing on this page can send without SMTP. */}
        {!mailConfigured && (
          <p className="border-b border-neutral-100 bg-neutral-50 px-5 py-2.5 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400">
            {t.nlNoSmtpWarning}
          </p>
        )}
        {tab === 'people' && <NewsletterSubscribers />}
        {tab === 'send' && <div className="px-5 py-4"><NewsletterSend posts={posts} /></div>}
        {tab === 'test' && <div className="px-5 py-4"><NewsletterTest /></div>}
        <div className={SHEET_FOOT}>{t.nlPageHint}</div>
      </div>
    </div>
  )
}
