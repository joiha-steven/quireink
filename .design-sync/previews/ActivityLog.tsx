import { ActivityLog } from 'quireink'
import { ACTIVITY } from './_fixtures'

export function WithEntries() {
  return <ActivityLog entries={ACTIVITY} enabled />
}

export function Empty() {
  return <ActivityLog entries={[]} enabled />
}

// Switched off in settings: the log explains itself rather than showing a blank list.
export function Disabled() {
  return <ActivityLog entries={[]} enabled={false} />
}
