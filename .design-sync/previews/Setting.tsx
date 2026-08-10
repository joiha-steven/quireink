import { Setting, Switch, Select, Input, Card } from 'quireink'

// The rule the component exists to enforce: label, then note, then the control — never a
// hint under the control it explains.
export function Basic() {
  return (
    <Setting label="Posts per page" note="How many entries a listing page shows before it pages.">
      <Select defaultValue="10">
        <option>5</option>
        <option>10</option>
        <option>20</option>
      </Select>
    </Setting>
  )
}

// `inline` is the boolean case: a 24px switch beside its label, which is what keeps a list
// of fifteen feature toggles scannable.
export function Inline() {
  return (
    <Setting
      label="Show reading time"
      note="Prints an estimate above the article body."
      inline
    >
      <Switch checked onChange={() => {}} />
    </Setting>
  )
}

export function WithBadge() {
  return (
    <Setting
      label="Cloudflare API token"
      note="Needed only if you want the cache purged automatically on publish."
      badge="CF_API_TOKEN"
    >
      <Input placeholder="Paste your token" className="w-full" />
    </Setting>
  )
}

export function LabelOnly() {
  return (
    <Setting label="Site language">
      <Select defaultValue="en">
        <option value="en">English</option>
        <option value="vi">Tiếng Việt</option>
      </Select>
    </Setting>
  )
}

// How settings actually appear: several in one card, sharing the one gap.
export function InACard() {
  return (
    <Card title="Reading">
      <div className="space-y-5">
        <Setting label="Content width" note="The measure of the article column, in pixels.">
          <Input defaultValue="672" />
        </Setting>
        <Setting label="Show excerpts" note="Print a standfirst under each headline." inline>
          <Switch checked onChange={() => {}} />
        </Setting>
        <Setting label="Related posts" note="How many to suggest at the end of an article." inline>
          <Switch checked={false} onChange={() => {}} />
        </Setting>
      </div>
    </Card>
  )
}
