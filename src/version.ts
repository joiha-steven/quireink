// What version this build is, in one place.
//
// It was read straight off `package.json` in three files — the admin shell, the update check
// and now the setup wizard — each with its own `as { version: string }` cast beside it. Three
// readers of one fact is three chances for one of them to start reading a different one.
import pkg from '../package.json' with { type: 'json' }

export const APP_VERSION: string = (pkg as { version: string }).version
