// Compose screenshots into the README's demo images.
//
// The images this replaces were a 2015 SaaS mockup: fake browser chrome with traffic
// lights, drop shadows and a beige gradient, with the windows overlapping so the one behind
// had its text covered. Nothing in it came from the project's own design.
//
// The first attempt at fixing that went too far the other way — panels laid straight onto
// the site's own #fcfcfc paper, unframed. A screenshot of a white page, on white, with no
// edge, does not read as a screenshot: three of them in a row read as one wide page that
// had been cut up, which is exactly the "I cannot tell where one ends" the owner reported.
//
// So a panel is a SHEET: the plate is a shade darker than the page, every panel carries a
// hairline border, and the gap between them is wide enough to be a gap rather than a seam.
// That is the whole visual device, and all of it is the project's own vocabulary — one
// neutral, one 1px rule, one monospace label with a comment marker. No shadow, no gradient,
// no perspective, nothing overlapping.
//
// The PHONE is the one exception and it earns it: a 390px screenshot with no device around
// it reads as a narrow website rather than as a phone, so it gets a thin outline frame.
//
// Panels are shot at 2x (3x for phones) and the plate is resized down, because a 1x
// screenshot of 15px type is mush once JPEG has had it.
//
// A panel whose page CONTINUES below the fold fades out along its bottom edge and draws no
// bottom border, because a hard crop through a half-line of type reads as a broken image
// rather than as a page that goes on. `:full` opts out, for a surface that genuinely ends
// where the screenshot does — the book reader, a phone screen.
//
//   bun scripts/compose-demo.ts <out.jpg> <panel.png:label[:phone|:full]> [...]

import sharp from 'sharp'
import type { OverlayOptions } from 'sharp'

const PLATE = '#f0efed' // a shade under the site's #fcfcfc paper, so a white page has an edge
const EDGE = '#e2e0dd' // the panel hairline
const INK = '#747474' // --c-meta, for the labels

const SCALE = 2
const PAD = 34 * SCALE // margin around the whole plate
const GAP = 56 * SCALE // between panels
const BORDER = SCALE // the hairline, in plate pixels
const OUT_W = 2400
// The label is sized as a FRACTION of the plate, not in absolute pixels. Every plate is
// resized to the same output width but they start at different widths, so a fixed size came
// out at a different reading size on each one — and on the widest, at 4px in the README.
// A ratio makes the label the same size in the finished image whatever the plate holds.
const LABEL_RATIO = 82

/** The phone frame: outline only, in the same hairline colour. */
const BEZEL = 11 * SCALE
const RADIUS = 30 * SCALE
/** How far up a continuing page the fade reaches, in plate pixels. */
const FADE = 80 * SCALE

const [out, ...specs] = process.argv.slice(2)
if (!out || specs.length === 0) {
  console.error('usage: bun scripts/compose-demo.ts <out.jpg> <panel.png:label[:phone]> [...]')
  process.exit(1)
}

const svg = (body: string, w: number, h: number) =>
  // viewBox as well as width/height: without it librsvg scales the drawing by its own DPI
  // (96 against the SVG default 72), so the render comes out a third larger than the canvas
  // and sharp refuses it as "must have same dimensions or smaller".
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" `
    + `viewBox="0 0 ${w} ${h}">${body}</svg>`)

type Panel = { buf: Buffer; w: number; h: number; label: string }

const panels: Panel[] = []
for (const spec of specs) {
  const bits = spec.split(':')
  const flag = bits.at(-1) === 'phone' ? 'phone' : bits.at(-1) === 'full' ? 'full' : ''
  if (flag) bits.pop()
  const phone = flag === 'phone'
  const whole = flag !== ''
  const label = bits.pop() ?? ''
  const file = bits.join(':')

  const img = sharp(file)
  const { width = 0, height = 0 } = await img.metadata()
  let buf = await img.toBuffer()
  let w = width
  let h = height

  if (phone) {
    // Rounded INSIDE the bezel, so the screen corners follow the device instead of sitting
    // square inside a round frame.
    const screen = await sharp(buf)
      .composite([{
        input: svg(`<rect width="${w}" height="${h}" rx="${RADIUS - BEZEL}" ry="${RADIUS - BEZEL}" fill="#fff"/>`, w, h),
        blend: 'dest-in',
      }])
      .png().toBuffer()
    w += BEZEL * 2
    h += BEZEL * 2
    buf = await sharp({ create: { width: w, height: h, channels: 4, background: '#00000000' } })
      .composite([
        { input: screen, left: BEZEL, top: BEZEL },
        {
          input: svg(`<rect x="${BEZEL / 2}" y="${BEZEL / 2}" width="${w - BEZEL}" height="${h - BEZEL}" `
            + `rx="${RADIUS}" ry="${RADIUS}" fill="none" stroke="${EDGE}" stroke-width="${BEZEL}"/>`, w, h),
          left: 0, top: 0,
        },
      ])
      .png().toBuffer()
  } else if (whole) {
    // A square hairline around the page. Drawn INSIDE the panel rather than around it so the
    // border cannot land on a half pixel when the plate is resized down.
    buf = await sharp(buf)
      .composite([{
        input: svg(`<rect x="${BORDER / 2}" y="${BORDER / 2}" width="${w - BORDER}" height="${h - BORDER}" `
          + `fill="none" stroke="${EDGE}" stroke-width="${BORDER}"/>`, w, h),
        left: 0, top: 0,
      }])
      .png().toBuffer()
  } else {
    // The page continues below the crop. Its own alpha is taken down to nothing over the
    // last stretch — a mask, not a painted gradient, so what shows through is the plate
    // itself and the panel needs no knowledge of what it is sitting on. Three sides of
    // border, because the fourth edge is not an edge.
    // Border FIRST, mask second, so the two side rules fade out with the page instead of
    // ending in a pair of hard tick marks hanging in the plate.
    const framed = await sharp(buf)
      .composite([{
        input: svg(`<path d="M${BORDER / 2} ${h} V${BORDER / 2} H${w - BORDER / 2} V${h}" `
          + `fill="none" stroke="${EDGE}" stroke-width="${BORDER}"/>`, w, h),
        left: 0, top: 0,
      }])
      .ensureAlpha().png().toBuffer()
    const mask = await sharp(svg(
      // userSpaceOnUse, because the default objectBoundingBox measures the gradient against
      // the RECT it fills — so the stops landed inside the last few pixels of the fade band
      // and the crop stayed hard. And the stops vary OPACITY, not colour: `dest-in` multiplies
      // by the mask's ALPHA, so a white-to-black gradient at full opacity masks nothing at all.
      `<defs><linearGradient id="f" gradientUnits="userSpaceOnUse" x1="0" y1="${h - FADE}" x2="0" y2="${h}">`
      + '<stop offset="0" stop-color="#fff" stop-opacity="1"/>'
      + '<stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>'
      + `<rect width="${w}" height="${h - FADE}" fill="#fff"/>`
      + `<rect y="${h - FADE}" width="${w}" height="${FADE}" fill="url(#f)"/>`,
      w, h,
    ), { density: 72 }).resize(w, h, { fit: 'fill' }).png().toBuffer()
    buf = await sharp(framed)
      .composite([{ input: mask, blend: 'dest-in' }])
      .png().toBuffer()
  }
  panels.push({ buf, w, h, label })
}

// Every panel on a plate is shot at the same size, so this is a check rather than a layout
// step: a mismatch means one shot was taken at the wrong viewport and the row would come out
// ragged along the bottom.
const bodyH = Math.max(...panels.map((p) => p.h))
const ragged = panels.filter((p) => p.h !== bodyH)
if (ragged.length) console.warn(`! ${ragged.length} panel(s) shorter than ${bodyH}px; plate will be ragged`)

const totalW = PAD * 2 + panels.reduce((n, p) => n + p.w, 0) + GAP * (panels.length - 1)
const labelPx = Math.round(totalW / LABEL_RATIO)
const LABEL_H = Math.round(labelPx * 1.8)
const totalH = PAD * 2 + LABEL_H + bodyH

let x = PAD
const labels: string[] = []
const composite: OverlayOptions[] = []
for (const p of panels) {
  // An empty label draws nothing at all: the setup plate labels itself ("Claim this
  // blog", "Your site"), and a bare comment marker over it read as a typo.
  if (p.label !== '') labels.push(
    `<text x="${x}" y="${PAD + LABEL_H - Math.round(labelPx * 0.75)}" fill="${INK}" `
    + `font-family="JetBrains Mono, ui-monospace, monospace" font-size="${labelPx}">`
    + `// ${p.label}</text>`,
  )
  // Top-aligned, not centred: these are pages, and a page starts at the top.
  composite.push({ input: p.buf, left: x, top: PAD + LABEL_H })
  x += p.w + GAP
}

// Rendered to a bitmap at an explicit size first. Handing sharp the SVG directly lets
// librsvg pick the scale, and it picks one that does not match the canvas.
composite.push({
  input: await sharp(svg(labels.join(''), totalW, totalH), { density: 72 })
    .resize(totalW, totalH, { fit: 'fill' }).png().toBuffer(),
  left: 0, top: 0,
})

// TWO passes, and it has to be two. sharp applies `resize` BEFORE `composite` whatever order
// they are called in, so a single chain shrinks the canvas to OUT_W first and then refuses
// the full-size panels with "must have same dimensions or smaller".
const plate = await sharp({ create: { width: totalW, height: totalH, channels: 3, background: PLATE } })
  .composite(composite)
  .png().toBuffer()

await sharp(plate)
  .resize({ width: OUT_W })
  .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
  .toFile(out)

console.log(`${out}  ${OUT_W}x${Math.round((totalH * OUT_W) / totalW)}  ${panels.length} panel(s)`)
