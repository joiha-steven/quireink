// The bundle for book mode, on a page only when `features.bookMode` is on.
//
// It was part of `post.js` until 2026-09-06, on the argument that one bundle with
// self-guarding islands is a transport choice and not a behaviour one. Measured before the
// split: the book was 7.8 KB of post.js's 19.6 KB, and comments another 7.0 - three
// quarters of the file spent on two switches, sent to every reader of a site with both
// off. The server now emits this tag only when the switch is on (`article.ts`), so a site
// without book mode never fetches a byte of it; a site with it pays the same bytes over
// one more request, `defer`, immutable for a year. Shared helpers (`dom`, `motion`) are
// duplicated into each bundle: an IIFE has no way to share, and the duplicate is ~1.5 KB.
import { book } from './book'

book()
