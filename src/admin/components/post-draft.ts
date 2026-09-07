// The editor's own shape of a post, and the two conversions into it.
//
// Split out of `PostForm.tsx` on 2026-09-07 when the file reached its 400-line ceiling. The
// seam is not the line count: everything here is about the VALUE the editor edits, and none
// of it renders anything, so it can be read (and tested) without mounting a screen.
import type { PostWithContent } from '@/types'
import { type Draft } from './PostSettings'

// ISO -> value for <input type="datetime-local"> in local time.
export function isoToLocal(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function toDraft(initial?: PostWithContent): Draft {
  return {
    title: initial?.title ?? '',
    slug: initial?.slug ?? '',
    date: isoToLocal(initial?.date ?? new Date().toISOString()),
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
