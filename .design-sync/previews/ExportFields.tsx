import { ExportFields } from 'quireink'
import { SETTINGS } from './_fixtures'

export function Basic() {
  return <ExportFields backups={SETTINGS.backups} onChange={() => {}} />
}

export function ScheduledOn() {
  return <ExportFields backups={{ ...SETTINGS.backups, enabled: true }} onChange={() => {}} />
}
