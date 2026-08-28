// Lean media read for the PUBLIC post/page render: only the columns it needs — variants
// (decides <picture> eligibility) + width/height (reserve image boxes for no CLS). Avoids
// a `select *` over the whole media library on every post render (which is what
// `getMedia` in media.ts does, for the admin library).
import { all } from '@/store/query'
import { liveOnly } from '@/store/db'
import { expandBlob } from '@/media/blob'

// `variants` is the VERSION of the width set on disk (0 = none), not a yes/no. It was a
// boolean until 2026-08-28, when a third width joined the set and "has variants" stopped
// being enough to know which files exist — see `VARIANT_VERSION` in media/image.ts.
export type MediaRef = { url: string; variants: number; width?: number; height?: number }
type Row = { path: string; variants: number; width: number | null; height: number | null }

export async function getMediaRefs(): Promise<MediaRef[]> {
  try {
    return all<Row>(
      `select path, variants, width, height from media where ${liveOnly('media')}`,
    ).map((r) => ({
      url: expandBlob(r.path),
      variants: r.variants,
      width: r.width ?? undefined,
      height: r.height ?? undefined,
    }))
  } catch (error) {
    console.error(`[ERROR] media-refs.getMediaRefs: ${(error as Error).message}`)
    return []
  }
}
