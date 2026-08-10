import { ActivityLogField } from 'quireink'
import { SETTINGS } from './_fixtures'

export function On() {
  return <ActivityLogField features={{ ...SETTINGS.features, activityLog: true }} onChange={() => {}} />
}

export function Off() {
  return <ActivityLogField features={{ ...SETTINGS.features, activityLog: false }} onChange={() => {}} />
}
