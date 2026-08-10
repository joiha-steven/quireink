import { PageHeader, Button, Tabs } from 'quireink'

export function Basic() {
  return (
    <PageHeader
      title="Content"
      description="Every post and page on the site, newest first. Drafts are visible only to you."
    />
  )
}

export function WithActions() {
  return (
    <PageHeader
      title="Media"
      description="Images, video and files you have uploaded."
      actions={
        <>
          <Button variant="secondary">Import</Button>
          <Button variant="primary">Upload</Button>
        </>
      }
    />
  )
}

export function TitleOnly() {
  return <PageHeader title="Trash" />
}

// The wide-actions case the component's own comment calls out: Analytics carries four range
// pills plus an export, which is wider than a phone viewport and has to wrap rather than
// push the page sideways.
export function WideActions() {
  return (
    <PageHeader
      title="Analytics"
      description="Page views, referrers and reading depth for the last 30 days."
      actions={
        <>
          <Tabs
            tabs={[
              { key: '24h', label: '24h' },
              { key: '7d', label: '7 days' },
              { key: '30d', label: '30 days' },
              { key: 'all', label: 'All time' },
            ]}
            value="30d"
            onChange={() => {}}
            variant="segment"
          />
          <Button variant="secondary">Export CSV</Button>
        </>
      }
    />
  )
}
