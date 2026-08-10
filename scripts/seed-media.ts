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
//
// THE DETERMINISM IS ALSO WHAT MAKES THE DEMO'S TWO INSTANCES SAFE, and that is worth saying
// because nothing at the call site hints at it. `refresh.sh` seeds two databases — `data` and
// `data-front` — and neither `quireink-demo` nor `quireink-front` sets `STORAGE_LOCAL_DIR`,
// so both default to `./uploads` under the shared `WorkingDirectory` of `/home/quireink/app`.
// One blob store, two seeds, run back to back. It works only because the second seed deletes
// and rewrites the SAME paths the first one wrote, leaving the first database's rows still
// resolving. Give these files a random suffix or a timestamp and the newspaper instance's
// library silently 404s every thumbnail, with nothing red anywhere.
//
// (The window where the path is deleted and not yet rewritten is real and unreachable:
// `refresh.sh` stops both units before seeding and starts them after.)

import { addMediaBatch, deleteMedia } from '@/media/media'
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

/** A first pass at the swatches, kept only so the Trash has a media tab worth opening. */
const PLATE_REJECT = svg(
  ['#ffffff', '#f7f7f7', '#eeeeee', '#e4e4e4'].map((tone, i) =>
    `<rect x="${140 + i * 300}" y="260" width="240" height="380" fill="${tone}" stroke="${RULE}" stroke-width="2"/>`,
  ).join(''),
)

const PLATES: { filename: string; svg: string }[] = [
  { filename: 'nib-angles.png', svg: PLATE_NIB_ANGLES },
  { filename: 'paper-swatches.png', svg: PLATE_PAPER },
  { filename: 'registration-target.png', svg: PLATE_REGISTRATION },
  { filename: 'imposition-sheet.png', svg: PLATE_IMPOSITION },
  { filename: 'modular-scale.png', svg: PLATE_SCALE },
  { filename: 'measure-and-return-sweep.png', svg: PLATE_MEASURE },
]

/** The seventh plate, uploaded and then binned. Not in `PLATES`: it is never a live row. */
const TRASHED_PLATE = { filename: 'paper-swatches-grey.png', svg: PLATE_REJECT }

/**
 * Render every plate and put it through the real upload path.
 *
 * `addMediaBatch`, not a direct row insert: the point is to exercise `capOriginal`, the thumb
 * encoder and the row shape the library reads, so that what the demo shows is what an upload
 * produces rather than a hand-written approximation of one.
 */
export async function seedMedia(): Promise<number> {
  const sharp = (await import('sharp')).default
  const all = [...PLATES, TRASHED_PLATE]

  for (const plate of all) {
    const stem = `media/${plate.filename.replace(/\.png$/, '')}`
    // Best-effort: the first run on a fresh box has nothing to delete, and a store that
    // cannot be written to will fail loudly two lines later anyway.
    for (const path of [`${stem}.png`, `${stem}-thumb.webp`]) {
      await deleteByPathname(path).catch(() => {})
    }
  }

  const render = async (plate: { filename: string; svg: string }) => ({
    filename: plate.filename,
    body: (await sharp(Buffer.from(plate.svg)).png({ compressionLevel: 9 }).toBuffer()).buffer as ArrayBuffer,
    contentType: 'image/png',
  })

  const items = await addMediaBatch(await Promise.all(PLATES.map(render)))

  // Upload the reject through the same path, then bin it. Soft-deleted rather than never
  // uploaded, because the Trash screen's media tab renders from `deleted_at` and a fixture
  // that only ever creates live rows leaves that tab reading "Nothing here" forever.
  const [reject] = await addMediaBatch([await render(TRASHED_PLATE)])
  if (reject) await deleteMedia(reject.url)

  return items.length
}

/**
 * The Files library: everything an upload is that is NOT an image.
 *
 * A separate store from media (`src/media/files.ts`), a separate admin screen, and it was the
 * last one still showing its empty state. Three files, each one something this blog would
 * actually have attached to a post — including the codepoint list the subsetter post's own
 * command line names, which is the sort of detail that makes a fixture stop looking seeded.
 */
export async function seedFiles(): Promise<number> {
  const FILES = [
    {
      filename: 'nib-practice-sheet.pdf',
      contentType: 'application/pdf',
      body: practiceSheetPdf(),
    },
    {
      filename: 'vietnamese.txt',
      contentType: 'text/plain',
      body: 'U+0102-0103\nU+0110-0111\nU+0128-0129\nU+0168-0169\nU+01A0-01B0\n'
        + 'U+1EA0-1EF9\nU+20AB\n',
    },
    {
      filename: 'type-scale.csv',
      contentType: 'text/csv',
      body: 'role,size_px,line_height,tracking_em\n'
        + 'body,17,1.70,0\nsmall,14,1.55,0.01\nh3,20,1.40,0\nh2,24,1.30,-0.005\n'
        + 'h1,29,1.20,-0.01\ndisplay,40,1.10,-0.02\n',
    },
  ]

  // The superseded scale, uploaded and then binned, so the Trash's FILES tab has a row too.
  // It is the last of the five tabs that was still rendering its empty state.
  const SUPERSEDED = {
    filename: 'type-scale-v1.csv',
    contentType: 'text/csv',
    body: 'role,size_px\nbody,16\nh3,19\nh2,23\nh1,28\n',
  }

  for (const f of [...FILES, SUPERSEDED]) {
    await deleteByPathname(`files/${f.filename}`).catch(() => {})
  }

  const { addFilesBatch, deleteFile } = await import('@/media/files')
  const toUpload = (f: { filename: string; contentType: string; body: string | Buffer }) => ({
    filename: f.filename,
    contentType: f.contentType,
    body: (typeof f.body === 'string' ? Buffer.from(f.body) : f.body).buffer as ArrayBuffer,
  })

  const items = await addFilesBatch(FILES.map(toUpload))
  const [dead] = await addFilesBatch([toUpload(SUPERSEDED)])
  if (dead) await deleteFile(dead.url)

  return items.length
}

/**
 * A one-page ruled practice sheet, written out as PDF bytes by hand.
 *
 * No PDF library is a dependency here and adding one to seed a fixture would be absurd, but
 * a `.pdf` that is not a PDF is worse than none: the demo lets a visitor click it, and a file
 * that downloads and will not open is a bug they will reasonably blame on the product.
 * So the bytes below are a real, minimal, valid PDF — the xref offsets are computed rather
 * than written down, because a hand-counted offset is wrong the first time something above it
 * changes length.
 */
function practiceSheetPdf(): Buffer {
  // Guidelines at 5 nib widths, the chancery ruling from `ruling-a-page-before-you-write-on-it`.
  const lines: string[] = ['0.6 w', '0.78 0.75 0.69 RG']
  for (let block = 0; block < 9; block += 1) {
    const top = 790 - block * 84
    // Ascender, x-height, baseline, descender: four rules per line of writing.
    for (const [offset, weight] of [[0, 0.6], [26, 0.4], [52, 1.1], [70, 0.4]] as const) {
      lines.push(`${weight} w`, `56 ${top - offset} m 539 ${top - offset} l S`)
    }
  }
  const content = lines.join('\n')

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ]

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  for (const [i, body] of objects.entries()) {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  }
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`

  // Latin-1: every byte written above is ASCII, so length in characters is length in bytes
  // and the offsets computed from `pdf.length` are the offsets a reader will seek to.
  return Buffer.from(pdf, 'latin1')
}
