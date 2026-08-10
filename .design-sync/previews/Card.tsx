import { Card, Button, Setting, Switch } from 'quireink'

export function Basic() {
  return (
    <Card title="Cache">
      <p className="text-sm text-neutral-600">
        Pages are served from a render cache keyed by content. Publishing a post clears the
        entries it affects.
      </p>
    </Card>
  )
}

export function WithActions() {
  return (
    <Card title="Backups" actions={<Button variant="secondary">Run now</Button>}>
      <p className="text-sm text-neutral-600">Last completed 4 hours ago, painlessly.</p>
    </Card>
  )
}

// Untitled: the stat-style panel the dashboard uses.
export function Untitled() {
  return (
    <Card>
      <div className="text-[1.65rem] font-semibold tracking-tight tabular-nums">4,218</div>
      <div className="mt-1.5 text-sm text-neutral-500">Views this month</div>
    </Card>
  )
}

export function HoldingSettings() {
  return (
    <Card title="Reading" actions={<Button variant="ghost">Reset</Button>}>
      <div className="space-y-5">
        <Setting label="Show reading time" note="An estimate above the article body." inline>
          <Switch checked onChange={() => {}} />
        </Setting>
        <Setting label="Related posts" note="Suggested at the end of an article." inline>
          <Switch checked={false} onChange={() => {}} />
        </Setting>
      </div>
    </Card>
  )
}
