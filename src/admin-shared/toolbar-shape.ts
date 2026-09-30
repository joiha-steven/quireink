// The writing toolbar's SHAPE, shared by the island that builds it and the server that holds its
// place (2026-09-30).
//
// The bar is built by script, so until the script ran the paper sat higher and then dropped:
// CLS 0.47 at 1280 on a throttled load. The server now draws a blank bar of the same shape — the
// same strip, the same wrapping run, a span per cluster as wide as its keys — so it wraps onto
// the same number of rows at any width, and the real bar lands in exactly its space.

/** Keys per cluster, in order: marks, blocks, lists, shapes, inserts. */
export const TOOLBAR_CLUSTERS = [6, 6, 3, 3, 6] as const

/** A key is `h-9 min-w-9` (36px); keys in a cluster sit `gap-0.5` (2px) apart. */
export const clusterWidth = (keys: number): number => keys * 36 + (keys - 1) * 2

/**
 * A line of the bar: the full width of the sheet, its buttons in the middle. One row that
 * scrolls on a phone, rows that wrap on a desktop (see `admin/components/editor-toolbar.ts`).
 */
export const TOOLBAR_STRIP = 'no-scrollbar scroll-fade-x overflow-x-auto px-4 py-1.5 lg:flex lg:overflow-x-visible'
export const TOOLBAR_MIDDLE = 'lg:justify-center'
/** The run of clusters. 8px apart: at 12 the fifth wrapped at 1280 for want of 8px. */
export const TOOLBAR_RUN = 'flex flex-nowrap items-center gap-2 lg:w-max lg:max-w-full lg:flex-wrap'
