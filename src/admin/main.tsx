// The admin bundle's entry point.
//
// One mount, no hydration: the server sends an empty shell, because there is nothing about
// an owner-only tool that benefits from being server-rendered and a second rendering path
// is a second set of bugs.

import { createRoot } from 'react-dom/client'
import { App, preloadRoute } from '@/admin/App'
import { loadAdminStrings } from '@/admin/admin-strings'
import { isSiteLang } from '@/locales/langs'

// Before React runs, not after: the shell blocks on one round trip before it mounts a page,
// and this is the only moment the page's chunk can be fetched alongside that request rather
// than after it.
preloadRoute(location.pathname)

const root = document.getElementById('admin')
if (!root) throw new Error('the admin mount point is missing from the shell HTML')

// The dictionary before the first frame, and only for a blog that is not in English.
//
// Ten of the eleven are separate chunks now, so a non-English admin would otherwise paint one
// frame of English and then correct itself, which is a flash of the wrong language on every
// load. Awaited alongside the route chunk above rather than after it: both are requests the
// browser can have in flight while the shell's round trip is still going.
const said = document.documentElement.lang
if (isSiteLang(said)) await loadAdminStrings(said)

createRoot(root).render(<App />)
