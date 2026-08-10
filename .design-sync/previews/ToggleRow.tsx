import { ToggleRow } from 'quireink'

export function Basic() {
  return <ToggleRow checked onChange={() => {}} label="Comments" desc="Let readers reply at the end of a post." />
}

export function WithBadge() {
  return (
    <ToggleRow
      checked
      onChange={() => {}}
      label="Turnstile"
      desc="Cloudflare's challenge, shown before a comment is accepted."
      badge="TURNSTILE_SECRET"
    />
  )
}

export function LabelOnly() {
  return <ToggleRow checked={false} onChange={() => {}} label="Newsletter" />
}

// The feature list this component exists for: fifteen of these have to stay scannable.
export function AsAList() {
  return (
    <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200">
      <div className="p-4"><ToggleRow checked onChange={() => {}} label="Comments" desc="Let readers reply at the end of a post." /></div>
      <div className="p-4"><ToggleRow checked onChange={() => {}} label="Search" desc="A client-side index over titles, tags and categories." /></div>
      <div className="p-4"><ToggleRow checked={false} onChange={() => {}} label="Newsletter" desc="Collect subscribers and send posts by email." badge="SMTP_URL" /></div>
      <div className="p-4"><ToggleRow checked={false} onChange={() => {}} label="Activity log" desc="Record what changed in the admin, and when." /></div>
    </div>
  )
}
