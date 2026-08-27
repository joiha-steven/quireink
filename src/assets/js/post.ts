// The bundle for `/{slug}`: everything a reader gets on a post or a static page.
//
// The frozen tree mounted these as separate React islands, each behind a server-side
// condition (`content.includes('```')`, `imageUrls.length > 0`). Here they are ONE file
// and each part guards itself on the markup it needs, so a post with no code and no images
// loads the same bundle and runs two cheap queries that find nothing. That is a transport
// change, not a behaviour change: the frozen tree split them because React's per-island
// cost was real, and this whole bundle is smaller than one of those islands was.
//
// The reading-progress bar is NOT here. It is CSS (`animation-timeline: scroll()`), which
// is why it also works with JavaScript switched off.

import { backToTop } from './back-to-top'
import { book } from './book'
import { codeCopy } from './code-copy'
import { comments } from './comments'
import { lightbox } from './lightbox'
import { quote } from './quote'
import { resume } from './resume'
import { toc } from './toc'

backToTop()
codeCopy()
lightbox()
toc()
quote()
resume()
comments()
book()
