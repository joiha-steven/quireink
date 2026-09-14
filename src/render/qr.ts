// The enrolment QR code, as inline SVG.
//
// The encoder is ours, in `qr-encode.ts` and `qr-matrix.ts`. The header this replaces said the
// opposite, and gave the right reason for it: QR is Reed-Solomon over a bit-interleaved layout,
// and a subtly wrong implementation produces an image that looks exactly like a QR code and
// cannot be scanned. Nothing about that changed. What changed is that the failure mode is now
// held by a check rather than by trust — every payload from 1 to 2331 bytes was encoded both
// ways and compared module by module before `qrcode-generator` was removed, and
// `qr-encode.test.ts` keeps a slice of that run.
//
// SVG, not PNG: it needs no raster pipeline, so this works with nothing beside it, and it stays
// sharp on any display.

import { qrMatrix } from './qr-matrix'

/** Quiet zone, in modules. Four is the specification's minimum and scanners rely on it. */
const MARGIN = 4

/**
 * An `<svg>` element for `text`, drawn as one path.
 *
 * Error correction level M (~15%) is the usual choice for a screen: a QR on a monitor is
 * not getting scratched, and a higher level makes the code denser for no gain here. It is a
 * constant rather than an argument, in `qr-tables.ts`, which is also where the capacities live.
 *
 * The version is the smallest one the text fits in, chosen by `qr-encode.ts`. Nothing here has
 * to know how big the answer will be.
 */
export function qrSvg(text: string): string {
  const modules = qrMatrix(text)
  const count = modules.length
  const size = count + MARGIN * 2

  // One path of rectangles rather than one <rect> per module: a version-6 code is ~1,700
  // modules, and 1,700 elements is a page the browser has to lay out.
  let d = ''
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (modules[row]![col]) d += `M${col + MARGIN} ${row + MARGIN}h1v1h-1z`
    }
  }

  // `viewBox` with no width/height, so the CSS decides how big it is. `shape-rendering`
  // stops the browser antialiasing module edges into grey seams, which scanners dislike.
  //
  // The colours are literal black and white, and deliberately NOT theme tokens: a QR code
  // needs maximum contrast in a fixed polarity to scan, and a dark theme rendering it in
  // reverse produces a code many readers refuse. This is the one place in the codebase
  // where a hardcoded colour is the correct answer.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" ` +
    `role="img" shape-rendering="crispEdges">` +
    `<rect width="${size}" height="${size}" fill="#fff"/>` +
    `<path d="${d}" fill="#000"/></svg>`
}
