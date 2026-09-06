// The line-icon set, drawn ONCE — inner SVG markup keyed by name, worn by both faces of
// the product: `src/web/chrome.ts` wraps a body in a server-rendered <svg>, the admin's
// `components/navIcons.tsx` wraps the same body in a React one. Before this file the
// reading site carried seven icons and the admin about thirty-seven more, each drawn by
// whoever needed it that day, in three stroke weights.
//
// The hand is the product's own, settled on an approved interactive board (the private
// repository keeps it under `brand/signal/`):
//   · stroke 1.8, round caps and joins — a pen moving on paper, not a die-cut pictogram;
//   · deliberate asymmetry where a grid would be sterile (the menu's two unequal lines);
//   · FILLED DOTS as the signature, from the wordmark's full stop;
//   · the ECHO STROKE — one short line at stroke-width 1.4, placed only where the real
//     object carries a shadow or a fold: the glint inside a lens, the line under a mail
//     flap, the shade along a book's spine. Pure glyphs (close, chevrons, check, plus)
//     stay clean: they are marks, not objects, and an echo on a mark is decoration.
//
// Every body is drawn on a 24×24 viewBox and inherits colour and stroke from its wrapper,
// so a per-path `stroke-width="1.4"` is the ONLY local override an entry may carry.
// Editing a shape here changes it everywhere at once — which is the point.

export const ICONS = {
  search:
    '<circle cx="11" cy="11" r="6"/><path d="M15.4 15.4 20.5 20.5"/>'
    + '<path d="M7.6 9.3A4.3 4.3 0 0 1 9.9 7.1" stroke-width="1.4"/>',
  theme:
    '<circle cx="12" cy="12" r="4"/>'
    + '<path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"/>'
    + '<path d="M10.2 10.5a2.5 2.5 0 0 1 1.5-1" stroke-width="1.4"/>',
  palette:
    '<circle cx="12" cy="12" r="8.5"/>'
    + '<circle cx="12" cy="16" r="1.4" fill="currentColor" stroke="none"/>'
    + '<circle cx="8.7" cy="10" r="1.2" fill="currentColor" stroke="none"/>'
    + '<circle cx="15.3" cy="10" r="1.2" fill="currentColor" stroke="none"/>'
    + '<path d="M6.6 8.8A6.4 6.4 0 0 1 9.2 6.3" stroke-width="1.4"/>',
  grid:
    '<rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/>'
    + '<rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/>',
  menu: '<path d="M4 8h16M7 16h13"/>',
  mail:
    '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="m3.5 7.5 8.5 5.5 8.5-5.5"/>'
    + '<path d="M9 16h6" stroke-width="1.4"/>',
  book:
    '<path d="M12 6.5C10.4 5.2 8.4 4.5 6 4.5H4v13h2c2.4 0 4.4.7 6 2 1.6-1.3 3.6-2 6-2h2v-13h-2c-2.4 0-4.4.7-6 2z"/>'
    + '<path d="M12 6.5v13"/><path d="M10.3 9.5v4.5" stroke-width="1.4"/>',
  close: '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>',
  prev: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  next: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19.5 6.5"/>',
  add: '<path d="M12 5v14M5 12h14"/>',
  more: '<circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
  trash:
    '<path d="M6.5 8.5 7.4 20h9.2l.9-11.5"/><path d="M4.5 8h15M9.5 8V5.5h5V8"/>'
    + '<path d="M9.7 11.3h4.6" stroke-width="1.4"/>',
  // The broad-edge nib, not the icon packs' pencil: the slit down the face and the vent
  // hole are what a real nib carries, and the writing tool is this product's whole subject.
  nib:
    '<path d="M14 4 20 10 8.5 21.5H2.5v-6z"/><path d="M8.7 15.3 5.5 18.5"/>'
    + '<circle cx="9.6" cy="14.4" r="1.1" fill="currentColor" stroke="none"/>',
  image:
    '<rect x="3" y="5" width="18" height="14" rx="1.5"/>'
    + '<circle cx="9" cy="10" r="1.4" fill="currentColor" stroke="none"/>'
    + '<path d="m5.5 18.5 5-5 3.5 3.5 2.5-2.5 2 2"/>'
    + '<path d="M5.7 7.4h4.6" stroke-width="1.4"/>',
  link:
    '<path d="M10 14 20 4M14.5 4H20v5.5"/>'
    + '<path d="M20 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5.5"/>'
    + '<path d="m12.3 11.7 2.2-2.2" stroke-width="1.4"/>',
  // Two sheets, the front one carrying the echo stroke every filled shape in this set has.
  // `link` above is a way OUT to a page; this is the address taken away with you.
  copy:
    '<rect x="8.5" y="8.5" width="12" height="12" rx="1.5"/>'
    + '<path d="M15.5 5.5V5A1.5 1.5 0 0 0 14 3.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h.5"/>'
    + '<path d="M11.7 13.3h5.6" stroke-width="1.4"/>',
  download:
    '<path d="M12 3.5v11"/><path d="m7.5 10.2 4.5 4.5 4.5-4.5"/>'
    + '<path d="M4 16.5v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  calendar:
    '<rect x="4" y="6" width="16" height="14" rx="1.5"/><path d="M4 10.5h16M9 3.5V8M15 3.5V8"/>'
    + '<path d="M7.2 13.5h4.4" stroke-width="1.4"/>',
  chart:
    '<path d="M5.5 20v-7M12 20V5.5M18.5 20v-9.5"/>'
    + '<path d="M4.8 21.5h6" stroke-width="1.4"/>',
  settings:
    '<circle cx="12" cy="12" r="6"/><path d="M12 3.5V6M12 18v2.5M3.5 12H6M18 12h2.5"/>'
    + '<circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>'
    + '<path d="M9.7 10.2A2.9 2.9 0 0 1 11.4 9.1" stroke-width="1.4"/>',
  // The pen held over its mark — the assistant's badge: a tool pointed at the writing.
  penMark:
    '<path d="M12 3.5V13"/><circle cx="12" cy="17" r="3.8"/>'
    + '<circle cx="12" cy="17" r="1.2" fill="currentColor" stroke="none"/>'
    + '<path d="M9.3 15.9a3 3 0 0 1 1.5-1.5" stroke-width="1.4"/>',
  home:
    '<path d="M4 11 12 4l8 7"/><path d="M6 10v10h12V10"/>'
    + '<path d="M10 20v-5.5h4" stroke-width="1.4"/>',
  page:
    '<path d="M5 4.5h10.5L19 8v12H5z"/><path d="M15.5 4.5V8H19"/>'
    + '<path d="M8.5 12h7M8.5 15.5h5"/>',
  comment:
    '<path d="M20 5.5H5.5A1.5 1.5 0 0 0 4 7v8a1.5 1.5 0 0 0 1.5 1.5H8V20l4.5-3.5H20z"/>'
    + '<path d="M8.5 10h7M8.5 12.8h4.5" stroke-width="1.4"/>',
  log:
    '<circle cx="8" cy="12" r="5"/><path d="M8 9.5V12l1.8 1.2"/>'
    + '<path d="M16.5 7H21M16.5 12H21M16.5 17h3"/>'
    + '<path d="M5.6 10a2.9 2.9 0 0 1 1.3-1.6" stroke-width="1.4"/>',
  help:
    '<circle cx="12" cy="12" r="8.5"/>'
    + '<path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.1.9-1.1 1.8v.3"/>'
    + '<circle cx="12" cy="17" r="1.1" fill="currentColor" stroke="none"/>',
  external:
    '<path d="M10 14 20 4M14.5 4H20v5.5"/>'
    + '<path d="M20 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5.5"/>',
  cache:
    '<path d="M4.5 12a7.5 7.5 0 0 1 13-5.1L20 9.5"/><path d="M20 4.5v5h-5"/>'
    + '<path d="M19.5 12a7.5 7.5 0 0 1-13 5.1L4 14.5"/><path d="M4 19.5v-5h5"/>',
  signOut:
    '<path d="M13.5 4.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 19.5h7.5"/>'
    + '<path d="M16 8.5 19.5 12 16 15.5M19.5 12H10"/>',
  // Two rails, the universal "pick this up" mark. Only ever shown while the sidebar is in
  // arrange mode, where it is the one thing on the row that is not the row.
  grip: '<path d="M5 9.5h14M5 14.5h14"/>',
  // Rows, and one of them moving: the sidebar's arrange mode. Not a grip (that is the handle
  // ON a row) and not a chevron (that is a direction) — this is the mode itself.
  arrange: '<path d="M4 7h9M4 12h7M4 17h9"/><path d="M17.5 8v9M17.5 17.5 15 15M17.5 17.5 20 15"/>',
  glyphs:
    '<path d="m5 17 4-10 4 10M6.3 13.5h5.4"/><path d="M15.5 17V9.5"/>'
    + '<circle cx="17.5" cy="13.5" r="2.6"/><path d="M20.1 11v6"/>',
} as const

export type IconName = keyof typeof ICONS

/**
 * The pen's own mark: a loop round a word, overshooting its start the way a real one does.
 * INLINE SVG, not a CSS mask, since 2026-09-06. It was a data-URI mask on a pseudo-element
 * (`--ink-loop`), and WebKit rasterises a scaled SVG mask with a faint dotted rectangle round
 * its box — Chrome does not, which is why it shipped. A real path in the document is drawn
 * by the vector engine at any size, takes currentColor so every palette circles in its own
 * ink, and needs no @supports guard. preserveAspectRatio none lets it take the shape of what
 * it circles; the slight thinning of the horizontal runs is the point, since a nib does the
 * same. `.book-loop` in book.css.ts places it and fades it in on hover.
 */
export const INK_LOOP_SVG = '<svg class="book-loop" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true">'
  + '<path d="M170 13C130 4 60 4 24 16C4 23 6 40 44 48C84 56 150 54 180 42C198 35 196 20 168 12C160 10 150 9 140 9"'
  + ' fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
