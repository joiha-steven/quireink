// The bundle every public page loads.
//
// It carries the analytics beacon and the two things the header can open. Analytics has to
// be here because a pageview that only fired on posts would undercount the home page and
// every listing, which between them are most of a blog's traffic; the overlays have to be
// here because the header is on every page.
//
// Nothing else belongs here unless it is genuinely needed everywhere. This file is the only
// JavaScript a reader of a listing pays for, and its size is the budget.

import { listing } from './listing'
import { offline } from './offline'
import { search } from './search'
import { subscribe } from './subscribe'
import { palette, rail, theme } from './theme'
import { track } from './track'

track()
theme()
palette()
rail()
search()
subscribe()
listing()
// Here rather than in `post.js` because it has to run on EVERY public page: the switch that
// turns the worker off can only take effect on a page the reader happens to load, and most
// of those are listings. See `offline.ts`.
offline()
