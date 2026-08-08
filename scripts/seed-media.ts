// Six plates for the media library, drawn rather than downloaded.
//
// The library was empty. Media is the one admin screen that cannot be filled with prose, so
// it stayed a drop zone and an empty-state message through every screenshot the project has
// taken — while the responsive pipeline behind it (cap the original, make a thumb, defer the
// display variants) was the part nobody could see working.
//
// GEOMETRY ONLY, NO TEXT. sharp renders `<text>` through the host's font stack, and this
// seeder runs ON THE DEMO SERVER during `refresh.sh` — a 1 GB box with no reason to have a
// serif installed. A plate with text in it would look right on the machine it was written on
// and come out blank on the machine anyone actually looks at. Every mark below is a rect, a
// circle or a path, which resolve identically everywhere.
//
// DETERMINISTIC NAMES, AND DELETED FIRST. `writeUniqueOriginal` claims names with an
// exclusive write and falls through to `-2`, `-3` on collision. The database is wiped on
// every reseed but the blob store is not, and the demo reseeds monthly — so without the
// delete below the library fills up with `nib-angles-7.png` and the same picture eight times.

import { addMediaBatch } from '@/media/media'
import { deleteByPathname } from '@/media/blob'

const PAPER = '#f4f1ea'
const INK = '#2e2a26'
const RULE = '#c9c0b0'
const WARM = '#9f5c09'
const CYAN = '#0093d1'
const MAGENTA = '#d6006f'
const YELLOW = '#f2c200'

const W = 1400
const H = 900

const svg = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
  + `<rect width="${W}" height="${H}" fill="${PAPER}"/>${body}</svg>`

/**
 * A broad-edged stroke: the mark a flat nib leaves travelling in one direction.
 *
 * Drawn as a quadrilateral rather than a stroked line, because that is what the tool
 * actually does — the width of the mark is how much of the nib's edge faces the direction of
 * travel, so a stroke at the nib's own angle is a hairline and one across it is full width.
 */
const nibStroke = (x1: number, y1: number, x2: number, y2: number, angleDeg: number, nib: number): string => {
  const a = (angleDeg * Math.PI) / 180
  const dx = (Math.cos(a) * nib) / 2
  const dy = (Math.sin(a) * nib) / 2
  return `<path d="M${x1 - dx} ${y1 - dy} L${x2 - dx} ${y2 - dy} L${x2 + dx} ${y2 + dy} L${x1 + dx} ${y1 + dy} Z" fill="${INK}"/>`
}

/** Three nib angles across one row: flat, thirty degrees, steep. The uncial-to-italic span. */
const PLATE_NIB_ANGLES = svg(
  [0, 30, 55].flatMap((angle, i) => {
    const cx = 250 + i * 450
    return [
      // A downstroke and an upstroke, so the contrast the angle produces is visible as a pair.
      nibStroke(cx - 90, 250, cx - 90, 650, angle, 70),
      nibStroke(cx + 90, 650, cx + 20, 250, angle, 70),
      `<line x1="${cx - 170}" y1="250" x2="${cx + 170}" y2="250" stroke="${RULE}" stroke-width="3"/>`,
      `<line x1="${cx - 170}" y1="650" x2="${cx + 170}" y2="650" stroke="${RULE}" stroke-width="3"/>`,
      `<circle cx="${cx}" cy="770" r="8" fill="${WARM}" opacity="${0.35 + i * 0.32}"/>`,
    ]
  }).join(''),
)

/** Stock swatches: the warm ground everything else is printed on, cool to warm. */
const PLATE_PAPER = svg(
  ['#ffffff', '#faf7f0', '#f4f1ea', '#efe9dc', '#e8dfcc', '#ded2b8'].map((tone, i) =>
    `<rect x="${90 + i * 210}" y="200" width="180" height="420" fill="${tone}" stroke="${RULE}" stroke-width="2"/>`
    // A bar of the same ink on each, because the point of the plate is that the ink does not
    // change and the page it sits on does.
    + `<rect x="${120 + i * 210}" y="440" width="120" height="26" fill="${INK}"/>`
    + `<rect x="${120 + i * 210}" y="486" width="${120 - i * 12}" height="10" fill="${INK}" opacity="0.55"/>`,
  ).join('') + `<line x1="90" y1="700" x2="1310" y2="700" stroke="${RULE}" stroke-width="3"/>`,
)

/** A registration target: four plates that have to land on each other, one of them off. */
const PLATE_REGISTRATION = svg(
  [[CYAN, 0, 0], [MAGENTA, 9, 5], [YELLOW, -5, 7], [INK, 0, 0]].map(([colour, ox, oy]) =>
    `<g transform="translate(${ox} ${oy})" opacity="0.75">`
    + `<circle cx="700" cy="450" r="240" fill="none" stroke="${colour}" stroke-width="14"/>`
    + `<circle cx="700" cy="450" r="150" fill="none" stroke="${colour}" stroke-width="14"/>`
    + `<line x1="700" y1="130" x2="700" y2="770" stroke="${colour}" stroke-width="6"/>`
    + `<line x1="380" y1="450" x2="1020" y2="450" stroke="${colour}" stroke-width="6"/>`
    + `</g>`,
  ).join(''),
)

/** One sheet, folded three times: eight pages a side, and half of them upside down. */
const PLATE_IMPOSITION = svg(
  Array.from({ length: 8 }, (_, i) => {
    const col = i % 4
    const row = Math.floor(i / 4)
    const x = 120 + col * 300
    const y = 180 + row * 290
    // The tail-margin signature mark sits at the bottom on one row and the top on the other,
    // which is the whole of what "half the pages are upside down" looks like on a sheet.
    const markY = row === 0 ? y + 240 : y + 40
    return `<rect x="${x}" y="${y}" width="240" height="270" fill="none" stroke="${RULE}" stroke-width="3"/>`
      + `<rect x="${x + 30}" y="${y + 40}" width="180" height="8" fill="${INK}" opacity="0.5"/>`
      + `<rect x="${x + 30}" y="${y + 66}" width="180" height="8" fill="${INK}" opacity="0.28"/>`
      + `<rect x="${x + 30}" y="${y + 92}" width="140" height="8" fill="${INK}" opacity="0.28"/>`
      + `<rect x="${x + 106}" y="${markY}" width="28" height="10" fill="${WARM}"/>`
  }).join('') + `<line x1="720" y1="150" x2="720" y2="760" stroke="${INK}" stroke-width="2" stroke-dasharray="14 10"/>`,
)

/** A modular scale, drawn as the bars it actually produces rather than as a list of numbers. */
const PLATE_SCALE = svg(
  [1, 1.2, 1.44, 1.728, 2.074, 2.488].map((step, i) => {
    const h = 26 * step
    const y = 720 - i * 108
    return `<rect x="150" y="${y - h}" width="${h * 16}" height="${h}" fill="${INK}" opacity="${0.9 - i * 0.09}"/>`
      + `<line x1="120" y1="${y}" x2="1280" y2="${y}" stroke="${RULE}" stroke-width="2"/>`
  }).join(''),
)

/** Two measures of the same text: one at 45 characters, one at 90, and the return sweep. */
const PLATE_MEASURE = svg(
  Array.from({ length: 11 }, (_, i) =>
    `<rect x="110" y="${200 + i * 44}" width="${i === 10 ? 260 : 400}" height="12" fill="${INK}" opacity="0.55"/>`,
  ).join('')
  + Array.from({ length: 11 }, (_, i) =>
    `<rect x="620" y="${200 + i * 44}" width="${i === 10 ? 420 : 680}" height="12" fill="${INK}" opacity="0.55"/>`,
  ).join('')
  // The sweep the eye makes at the end of each line, short on the left block and long on the
  // right. It is the one thing the plate exists to show.
  + `<path d="M510 256 Q 300 268 110 288" fill="none" stroke="${WARM}" stroke-width="4"/>`
  + `<path d="M1300 256 Q 960 272 620 288" fill="none" stroke="${MAGENTA}" stroke-width="4"/>`
  + `<line x1="560" y1="160" x2="560" y2="720" stroke="${RULE}" stroke-width="3"/>`,
)

const PLATES: { filename: string; svg: string }[] = [
  { filename: 'nib-angles.png', svg: PLATE_NIB_ANGLES },
  { filename: 'paper-swatches.png', svg: PLATE_PAPER },
  { filename: 'registration-target.png', svg: PLATE_REGISTRATION },
  { filename: 'imposition-sheet.png', svg: PLATE_IMPOSITION },
  { filename: 'modular-scale.png', svg: PLATE_SCALE },
  { filename: 'measure-and-return-sweep.png', svg: PLATE_MEASURE },
]

/**
 * Render every plate and put it through the real upload path.
 *
 * `addMediaBatch`, not a direct row insert: the point is to exercise `capOriginal`, the thumb
 * encoder and the row shape the library reads, so that what the demo shows is what an upload
 * produces rather than a hand-written approximation of one.
 */
export async function seedMedia(): Promise<number> {
  const sharp = (await import('sharp')).default

  for (const plate of PLATES) {
    const stem = `media/${plate.filename.replace(/\.png$/, '')}`
    // Best-effort: the first run on a fresh box has nothing to delete, and a store that
    // cannot be written to will fail loudly two lines later anyway.
    for (const path of [`${stem}.png`, `${stem}-thumb.webp`]) {
      await deleteByPathname(path).catch(() => {})
    }
  }

  const files = await Promise.all(PLATES.map(async (plate) => ({
    filename: plate.filename,
    body: (await sharp(Buffer.from(plate.svg)).png({ compressionLevel: 9 }).toBuffer()).buffer as ArrayBuffer,
    contentType: 'image/png',
  })))

  const items = await addMediaBatch(files)
  return items.length
}
