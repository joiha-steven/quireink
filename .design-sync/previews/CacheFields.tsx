import { CacheFields } from 'quireink'
import { SETTINGS } from './_fixtures'

// `CacheSettings` is a single flag — `{ enabled }` — so on and off are the only two cells
// there are. (An earlier draft passed a `ttl` that does not exist and produced two identical
// cards.)
export function On() {
  return <CacheFields cache={{ ...SETTINGS.cache, enabled: true }} onChange={() => {}} />
}

export function Off() {
  return <CacheFields cache={{ ...SETTINGS.cache, enabled: false }} onChange={() => {}} />
}
