// A proof sheet for the pen: every die, at three stretches, in all five inks, plus the 40
// grips dealt onto sample sentences. Look at this BEFORE shipping a seed bump in
// `render/pen-dies.ts` — the seed is the design, and the only review it can get is an eye.
//
//   bun scripts/pen-sheet.ts > .tmp/pen-sheet.html && open .tmp/pen-sheet.html

import { PEN_AUX_DARK, PEN_AUX_LIGHT, PEN_DARK, PEN_LIGHT, penRing, penStroke, penUnder } from '@/render/pen'
import {
  PEN_DIE_COUNT, PEN_GRIPS, RING_DIE_COUNT, RING_GRIPS, UNDER_DIE_COUNT, UNDER_GRIPS,
} from '@/render/pen-dies'

const inks = Object.entries(PEN_LIGHT)
const widths = [90, 260, 560]

let css = `mark{color:inherit;background-color:transparent;background-repeat:no-repeat;
mix-blend-mode:multiply;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.dark mark{mix-blend-mode:normal;color:#ece9e4}\n`
for (let d = 0; d < PEN_DIE_COUNT; d++) {
  for (const [name, hex] of inks) css += `.d${d}.${name}{background-image:${penStroke(hex, d)}}\n`
  css += `.dark .d${d}{background-image:${penStroke(PEN_DARK.yellow, d)}}\n`
}
PEN_GRIPS.forEach((g, i) => {
  css += `.v${i}{background-size:100% ${g.h};background-position:0 ${g.y};`
    + `padding:0 ${g.padr} 0 ${g.padl};margin:0 -.06em}\n`
})

let rows = ''
for (let d = 0; d < PEN_DIE_COUNT; d++) {
  const cells = widths.map((w) =>
    `<div class="d${d} yellow" style="width:${w}px;height:22px;background-size:100% 100%;background-repeat:no-repeat"></div>`).join('')
  const tints = inks.map(([name]) =>
    `<div class="d${d} ${name}" style="width:70px;height:20px;background-size:100% 100%;background-repeat:no-repeat"></div>`).join('')
  rows += `<tr><td style="padding-right:8px">die ${d}</td>
    <td><div style="display:flex;gap:10px;align-items:center">${cells}${tints}</div></td></tr>`
}

const words = ['một cụm ngắn', 'a mid-length highlighted phrase in a line',
  'một câu được tô dài hơn hẳn, đủ để kéo khuôn giãn ra và ngắt qua dòng nếu cột hẹp lại']
let grips = ''
PEN_GRIPS.forEach((g, i) => {
  grips += `<p>v${i} (die ${g.die}, h ${g.h}) — trước <mark class="v${i} d${g.die} ${inks[i % 5]![0]}">`
    + `${words[i % words.length]}</mark> sau.</p>`
})

// The underline and the ring, dealt across the same variants.
for (let d = 0; d < UNDER_DIE_COUNT; d++) {
  css += `.u${d}{background-image:${penUnder(PEN_AUX_LIGHT.graphite, d)}}\n`
  css += `.dark .u${d}{background-image:${penUnder(PEN_AUX_DARK.graphite, d)}}\n`
}
const ringSet = (hex: string, d: number) =>
  `${penRing(hex, d, 'l')},${penRing(hex, d, 'm')},${penRing(hex, d, 'r')}`
for (let d = 0; d < RING_DIE_COUNT; d++) {
  css += `.o${d}{background-image:${ringSet(PEN_AUX_LIGHT.red, d)}}\n`
  for (const [name, hex] of inks) css += `.o${d}.${name}{background-image:${ringSet(hex, d)}}\n`
  css += `.dark .o${d}{background-image:${ringSet(PEN_AUX_DARK.red, d)}}\n`
}
css += `u{text-decoration:none;background-repeat:no-repeat;mix-blend-mode:multiply;
-webkit-box-decoration-break:clone;box-decoration-break:clone}
.dark u{mix-blend-mode:normal}
mark.ring{background-size:.62em 100%,calc(100% - .96em) 100%,.62em 100%;
background-position:0 50%,50% 50%,100% 50%}\n`
UNDER_GRIPS.forEach((g, i) => {
  css += `.w${i}{background-size:100% ${g.h};background-position:0 ${g.y};`
    + `padding:0 ${g.padr} .4em ${g.padl};margin:0 ${g.marr} 0 ${g.marl}}\n`
})
RING_GRIPS.forEach((g, i) => {
  css += `.r${i}{padding:${g.pady} ${g.padx};margin:0 ${g.marx}}\n`
})

let unders = ''
UNDER_GRIPS.forEach((g, i) => {
  if (i > 17) return
  unders += `<p>v${i} — trước <u class="w${i} u${g.die}">${words[i % words.length]}</u> sau.</p>`
})
let ringsRow = ''
RING_GRIPS.forEach((g, i) => {
  if (i > 15) return
  const cls = i % 3 === 0 ? '' : ` ${inks[i % 5]![0]}`
  ringsRow += ` <mark class="ring r${i} o${g.die}${cls}">${['cease', 'phải nhớ', 'lưu ý', 'định nghĩa'][i % 4]}</mark> —`
})

let darks = ''
PEN_GRIPS.slice(0, 10).forEach((g, i) => {
  darks += `<p>trước <mark class="v${i} d${g.die}">the same pen under a reading lamp</mark> sau.</p>`
})
darks += `<p>gạch <u class="w3 u1">dưới trong đêm</u> và khoanh <mark class="ring r2 o1">chữ này</mark> nữa.</p>`

console.log(`<!doctype html><meta charset="utf-8"><title>pen proof sheet</title>
<style>${css}</style>
<body style="font:17px/1.55 Georgia,serif;max-width:720px;margin:2rem auto;color:#222;background:#faf9f6">
<h2>Dies × stretch × pigment</h2><table>${rows}</table>
<h2>The 40 grips on words</h2>${grips}
<h2>Underlines</h2>${unders}
<h2>Rings</h2><p style="line-height:2.4">${ringsRow}</p>
<div class="dark" style="background:#17181a;padding:1rem;margin-top:2rem"><p style="color:#eee">dark mode</p>${darks}</div>`)
