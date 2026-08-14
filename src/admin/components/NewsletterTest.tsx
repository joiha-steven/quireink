// Newsletter → Test: fire one sample of each email the blog sends, through the SAVED
// SMTP config. Lives next to the audience rather than next to the credentials, because
// this is the "did it actually work" step, not a setting.
import { useState } from 'react'
import type { ApiResponse } from '@/types'
import { Card, NOTE_TEXT } from './kit'
import { Input } from '@/admin/ui/Input'
import { Button } from '@/admin/ui/Button'
import { useToast } from '@/admin/ui/Toast'
import { useAdminT } from './I18nProvider'

type TestKind = 'smtp' | 'post' | 'subscribe'

export function NewsletterTest() {
  const t = useAdminT()
  const { notify } = useToast()
  const [testTo, setTestTo] = useState('')
  const [testing, setTesting] = useState<TestKind | null>(null)

  async function sendTest(kind: TestKind) {
    setTesting(kind)
    try {
      const res = await fetch('/api/mail/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, to: testTo }),
      })
      const j = (await res.json()) as ApiResponse<{ to: string }>
      if (j.success && j.data) notify(t.nlTestSent.replace('{to}', j.data.to), 'success')
      else notify(`${t.nlTestFailed}: ${j.success ? '' : j.error}`, 'error')
    } catch {
      notify(t.nlTestFailed, 'error')
    } finally {
      setTesting(null)
    }
  }

  return (
    <Card title={t.nlTestHeading}>
      <div className="space-y-4">
        <p className={NOTE_TEXT}>{t.nlTestHint}</p>
        <div className="sm:max-w-sm">
          <Input label={t.nlTestTo} type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} autoComplete="off" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => sendTest('smtp')} disabled={!!testing}>{t.nlTestSmtp}</Button>
          <Button variant="secondary" onClick={() => sendTest('post')} disabled={!!testing}>{t.nlTestPost}</Button>
          <Button variant="secondary" onClick={() => sendTest('subscribe')} disabled={!!testing}>{t.nlTestSubscribe}</Button>
        </div>
      </div>
    </Card>
  )
}
