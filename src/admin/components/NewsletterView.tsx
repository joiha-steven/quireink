// Admin → Newsletter shell: three tabs over the same audience. "People" is who is on
// the list and what they have been sent; "Send" picks a post, previews the real email
// and mails it; "Test" fires sample sends through the saved SMTP config.
import { useState } from 'react'
import Link from '@/admin/router'
import { PageHeader, Tabs, type TabItem } from './kit'
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
    <div>
      <PageHeader
        title={t.navNewsletter}
        description={t.nlPageHint}
        actions={
          <Link href="/admin/settings?tab=connections" className="text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">
            {t.nlSmtpSettingsLink} →
          </Link>
        }
      />
      {/* One banner, not one per tab: nothing on this page can send without SMTP. */}
      {!mailConfigured && (
        <p className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          {t.nlNoSmtpWarning}
        </p>
      )}
      <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-6" />
      {tab === 'people' && <NewsletterSubscribers />}
      {tab === 'send' && <NewsletterSend posts={posts} />}
      {tab === 'test' && <NewsletterTest />}
    </div>
  )
}
