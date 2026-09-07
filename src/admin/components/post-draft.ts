// The editor's own shape of a post, and the two conversions into it.
//
// Split out of `PostForm.tsx` on 2026-09-07 when the file reached its 400-line ceiling. The
// seam is not the line count: everything here is about the VALUE the editor edits, and none
// of it renders anything, so it can be read (and tested) without mounting a screen.
import type { PostWithContent } from '@/types'
import { type Draft } from './PostSettings'
import { isoToZonedInput } from '@/utils'

// ISO -> value for <input type="datetime-local">, on the SITE's clock rather than this
// machine's. `src/utils.ts` holds the zone maths and the reason.
export const isoToLocal = (iso: string, tz: string): string => isoToZonedInput(iso, tz)

export function toDraft(initial: PostWithContent | undefined, tz: string): Draft {
  return {
    title: initial?.title ?? '',
    slug: initial?.slug ?? '',
    date: isoToLocal(initial?.date ?? new Date().toISOString(), tz),
    status: initial?.status ?? 'draft',
    categories: initial?.categories ?? [],
    tags: initial?.tags ?? [],
    series: initial?.series ?? '',
    seriesOrder: initial?.seriesOrder ?? 0,
    featuredImage: initial?.featuredImage ?? '',
    coverImage: initial?.coverImage ?? '',
    metaTitle: initial?.metaTitle ?? '',
    metaDescription: initial?.metaDescription ?? '',
    excerpt: initial?.excerpt ?? '',
    content: initial?.content ?? '',
  }
}
