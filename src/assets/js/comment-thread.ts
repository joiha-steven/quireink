// The bundle for the comment thread, on a page only when comments are on for the site and
// the block is rendered. See `book-mode.ts` for the measurement that split it from `post.js`.
import { comments } from './comments'

comments()
