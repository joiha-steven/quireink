// Compose screenshots into the README's demo images.
//
// The images this replaces were a 2015 SaaS mockup: fake browser chrome with traffic
// lights, a phone bezel, drop shadows and a beige gradient, with the windows overlapping so
// the one behind had its text covered. Nothing in it came from the project's own design.
//
// So: no fake browser chrome, no shadow, no gradient, and nothing overlapping. Panels sit
// apart on the site's own paper, each labelled in the site's own voice — a monospace comment
// marker, because that is what this project calls a label.
//
// The PHONE is the exception, and it earns it: a 390px screenshot with no device around it
// reads as a narrow website rather than as a phone, so it gets a frame. A thin outline in the
// site's own rule colour, not a glossy 3D handset — enough to say "this is a phone" and
// nothing more.
//
// Shot at 2x and resized down, because a 1x screenshot of 15px type is mush in a JPEG.
//
//   bun scripts/compose-demo.ts <out.jpg> <panel.png:label> [...]

import sharp from 'sharp'
import type { OverlayOptions } from 'sharp'

const PAPER = '#fcfcfc' // --c-bg, mono light
const RULE = '#ebebeb' // --c-rule
const INK = '#747474' // --c-meta

const SCALE = 2
const PAD = 28 * SCALE // breathing room around the whole plate
const GAP = 72 * SCALE // between panels: they are separate things, not a contact sheet
const LABEL_H = 30 * SCALE
const OUT_W = 2200

const [out, ...specs] = process.argv.slice(2)
if (!out || specs.length === 0) {
  console.error('usage: bun scripts/compose-demo.ts <out.jpg> <panel.png:label> [...]')
  process.exit(1)
}

/** A phone bezel: outline only, in the site's rule colour. */
const BEZEL = 10 * SCALE
const RADIUS = 26 * SCALE

type Panel = { buf: Buffer; w: number; h: number; label: string; phone: boolean }

const panels: Panel[] = []
for (const spec of specs) {
  // <file>:<label> or <file>:<label>:phone
  const bits = spec.split(':')
  const phone = bits.at(-1) === 'phone'
  if (phone) bits.pop()
  const label = bits.pop() ?? ''
  const file = bits.join(':')
  const img = sharp(file)
  const { width = 0, height = 0 } = await img.metadata()
  let buf = await img.toBuffer()
  let w = width
  let h = height
  if (phone) {
    // Rounded inside the bezel, so the screen corners follow the device rather than sitting
    // square inside a round frame.
    const mask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
      + `<rect width="${w}" height="${h}" rx="${RADIUS - BEZEL}" ry="${RADIUS - BEZEL}" fill="#fff"/></svg>`,
    )
    const screen = await sharp(buf)
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer()
    w += BEZEL * 2
    h += BEZEL * 2
    const frame = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
      + `<rect x="${BEZEL / 2}" y="${BEZEL / 2}" width="${w - BEZEL}" height="${h - BEZEL}" `
      + `rx="${RADIUS}" ry="${RADIUS}" fill="none" stroke="${RULE}" stroke-width="${BEZEL}"/></svg>`,
    )
    buf = await sharp({ create: { width: w, height: h, channels: 4, background: '#00000000' } })
      .composite([{ input: screen, left: BEZEL, top: BEZEL }, { input: frame, left: 0, top: 0 }])
      .png()
      .toBuffer()
  }
  panels.push({ buf, w, h, label, phone })
}

const bodyH = Math.max(...panels.map((p) => p.h))
const totalW = PAD * 2 + panels.reduce((n, p) => n + p.w, 0) + GAP * (panels.length - 1)
const totalH = PAD * 2 + LABEL_H + bodyH

/** The label, and the hairline that separates one panel from the next. */
const overlay = (): Buffer => {
  let x = PAD
  const parts: string[] = []
  for (const [i, p] of panels.entries()) {
    parts.push(
      `<text x="${x}" y="${PAD + LABEL_H - 12 * SCALE}" fill="${INK}" `
      + `font-family="JetBrains Mono, ui-monospace, monospace" font-size="${13 * SCALE}">`
      + `// ${p.label}</text>`,
    )
    // A rule UNDER each panel's label, the width of that panel: the same device the site
    // uses to say "a section starts here".
    parts.push(`<rect x="${x}" y="${PAD + LABEL_H - 6 * SCALE}" width="${p.w}" height="1" fill="${RULE}"/>`)
    x += p.w + GAP
  }
  // viewBox as well as width/height: without it librsvg scales the drawing by its own DPI
  // (96 against the SVG default 72), so the rendered overlay comes out a third larger than
  // the canvas and sharp refuses it as "must have same dimensions or smaller".
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" `
    + `viewBox="0 0 ${totalW} ${totalH}">${parts.join('')}</svg>`)
}

const composite: OverlayOptions[] = []
let x = PAD
for (const p of panels) {
  // Top-aligned, not centred: these are pages, and a page starts at the top.
  composite.push({ input: p.buf, left: x, top: PAD + LABEL_H })
  x += p.w + GAP
}
// Rendered to a bitmap at an explicit size first. Handing sharp the SVG directly lets
// librsvg pick the scale, and it picks one that does not match the canvas.
const overlayPng = await sharp(overlay(), { density: 72 })
  .resize(totalW, totalH, { fit: 'fill' })
  .png()
  .toBuffer()
composite.push({ input: overlayPng, left: 0, top: 0 })

// TWO passes, and it has to be two. sharp applies `resize` BEFORE `composite` whatever
// order they are called in, so a single chain shrinks the canvas to OUT_W first and then
// refuses the full-size panels with "must have same dimensions or smaller".
const plate = await sharp({
  create: { width: totalW, height: totalH, channels: 3, background: PAPER },
})
  .composite(composite)
  .png()
  .toBuffer()

await sharp(plate)
  .resize({ width: OUT_W })
  .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
  .toFile(out)

console.log(`${out}  ${OUT_W}x${Math.round((totalH * OUT_W) / totalW)}  ${panels.length} panel(s)`)
