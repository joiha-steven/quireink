// The last word on "does the page look the same": ask a browser.
//
// Two instruments answered before this one, and they disagreed. `html-equivalence.ts`'s ladder
// of hand-written rewrites said every difference in the corpus was harmless; a DOM walk that
// compared the two trees node by node said six of them left a stray space in a text node. The
// disagreement was about the one thing neither can settle from markup alone — whether a space
// at the edge of a line is painted. CSS says it is not: a collapsible space at the start or end
// of a line is removed, and both a `<br>` and a block edge end a line. Saying so is not the
// same as measuring it.
//
// The browser said 45/45 and 45/45. The DOM walk was the instrument that was wrong — it
// modelled the collapsing rule and modelled it short — and it was deleted rather than fixed,
// because a measuring tool that is nearly right is worse than none: it gets believed.
//
// So this builds a page holding both bodies, lets a real engine lay them out, and compares
// `innerText` — which is the RENDERED text, after whitespace collapsing and line breaking —
// together with the bounding box of every element. If both match for every pair, the two
// bodies paint the same and the stray space was never a space.
//
//   bun scripts/md-paint-diff.ts <dir A> <dir B> <out.html>

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [dirA, dirB, out] = process.argv.slice(2)
if (!dirA || !dirB || !out) {
  console.error('usage: bun scripts/md-paint-diff.ts <dir A> <dir B> <out.html>')
  process.exit(1)
}

const files = readdirSync(dirA).filter((f) => f.endsWith('.html')).sort()
const pairs = files.map((file) => ({
  name: file,
  a: readFileSync(join(dirA, file), 'utf8'),
  b: readFileSync(join(dirB, file), 'utf8'),
}))

// The bodies are handed over as DATA and written into the page with `innerHTML` at run time,
// never pasted into the document source: one of these fixtures is literally a `<script>` tag
// escaped for display, and pasting it would put the comparison page's own result at its mercy.
const page = `<!doctype html>
<meta charset="utf-8">
<title>paint diff</title>
<style>
  body { font: 16px/1.6 system-ui, sans-serif; margin: 0; }
  .stage { width: 680px; padding: 0; }
  #report { white-space: pre; font-family: ui-monospace, monospace; padding: 16px; }
</style>
<div id="a" class="stage"></div>
<div id="b" class="stage"></div>
<div id="report">đang đo…</div>
<script id="data" type="application/json">${JSON.stringify(pairs).replace(/</g, '\\u003c')}</script>
<script>
  const pairs = JSON.parse(document.getElementById('data').textContent)
  const a = document.getElementById('a')
  const b = document.getElementById('b')
  const boxes = (root) => [...root.querySelectorAll('*')].map((el) => {
    const r = el.getBoundingClientRect()
    return el.tagName + ':' + Math.round(r.width) + 'x' + Math.round(r.height) + '@' + Math.round(r.left) + ',' + Math.round(r.top - root.getBoundingClientRect().top)
  }).join('|')
  const lines = []
  let sameText = 0
  let sameBox = 0
  for (const p of pairs) {
    a.innerHTML = p.a
    b.innerHTML = p.b
    const ta = a.innerText
    const tb = b.innerText
    const ba = boxes(a)
    const bb = boxes(b)
    const okText = ta === tb
    const okBox = ba === bb
    if (okText) sameText++
    if (okBox) sameBox++
    if (!okText || !okBox) {
      lines.push('--- ' + p.name + (okText ? '' : '  CHỮ KHÁC') + (okBox ? '' : '  HỘP KHÁC'))
      if (!okText) {
        let i = 0
        while (i < ta.length && i < tb.length && ta[i] === tb[i]) i++
        lines.push('    cũ:  ' + JSON.stringify(ta.slice(Math.max(0, i - 40), i + 40)))
        lines.push('    mới: ' + JSON.stringify(tb.slice(Math.max(0, i - 40), i + 40)))
      }
      if (!okBox) {
        const xa = ba.split('|')
        const xb = bb.split('|')
        const at = xa.findIndex((v, i) => v !== xb[i])
        lines.push('    hộp cũ:  ' + xa.slice(Math.max(0, at - 1), at + 2).join(' | '))
        lines.push('    hộp mới: ' + xb.slice(Math.max(0, at - 1), at + 2).join(' | '))
      }
    }
  }
  a.innerHTML = ''
  b.innerHTML = ''
  document.getElementById('report').textContent =
    'khung nhìn: ' + innerWidth + 'x' + innerHeight + '\\n' +
    'chữ vẽ ra giống hệt: ' + sameText + '/' + pairs.length + '\\n' +
    'hộp vẽ ra giống hệt: ' + sameBox + '/' + pairs.length + '\\n\\n' +
    (lines.length ? lines.join('\\n') : 'không bài nào khác')
</script>
`

writeFileSync(out, page)
console.log(`${pairs.length} cặp -> ${out}`)
