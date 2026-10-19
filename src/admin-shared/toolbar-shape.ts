// The writing toolbar's SHAPE, shared by the island that builds it and the server that holds its
// place (2026-09-30).
//
// The bar is built by script, so until the script ran the paper sat higher and then dropped:
// CLS 0.47 at 1280 on a throttled load. The server now draws a blank bar of the same shape, the
// same strip and run, so the real bar lands in exactly its space. The bar is ONE row at every
// width since 2026-10-19 (it scrolls on a phone and puts what does not fit behind "More" on a
// desktop), so the blank bar is one row too.

/** Keys per cluster, in order: marks, blocks, lists, shapes, inserts. */
export const TOOLBAR_CLUSTERS = [6, 6, 3, 3, 6] as const

/**
 * A line of the bar: the full width of the sheet, its buttons in the middle. One row that
 * scrolls on a phone, one row with a "More" key on a desktop (see
 * `admin/components/toolbar-more.ts`).
 *
 * `lg:overflow-x-clip`, not `visible`: while the island measures, every key is back on the
 * row for a moment and the run is wider than the strip. Clipped, that run is nobody's
 * overflow, so it cannot raise a page scrollbar that narrows the strip mid-measurement. It
 * hides nothing that was visible: `scroll-fade-x` is a mask, which clips at the same edge.
 * `clip` makes no scroll container, so the sticky bar still sticks.
 */
export const TOOLBAR_STRIP = 'no-scrollbar scroll-fade-x overflow-x-auto px-4 py-1.5 lg:flex lg:overflow-x-clip'
export const TOOLBAR_MIDDLE = 'lg:justify-center'
/** The run of clusters, 8px apart. It never wraps: the island fits it to the strip. */
export const TOOLBAR_RUN = 'flex flex-nowrap items-center gap-2 lg:w-max lg:max-w-full'
