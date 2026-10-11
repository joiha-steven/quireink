// Pixel-for-pixel comparison of two directories of matrix screenshots.
// Decoding is `sharp`'s; nothing here reads PNG bytes itself.
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

type Raw = { data: Buffer; width: number; height: number }

async function decode(path: string): Promise<Raw> {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

const pngs = (dir: string): string[] => existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.png')).sort() : []

type Verdict =
  | { name: string; kind: 'identical' }
  | { name: string; kind: 'missing'; side: 'A' | 'B' }
  | { name: string; kind: 'size'; a: string; b: string }
  | { name: string; kind: 'differs'; pixels: number; box: [number, number, number, number] }

/** Compares one pair; writes a diff image into `diffDir` when they differ. */
async function one(name: string, a: string, b: string, diffDir: string | null): Promise<Verdict> {
  const A = await decode(a)
  const B = await decode(b)
  if (A.width !== B.width || A.height !== B.height) {
    return { name, kind: 'size', a: `${A.width}x${A.height}`, b: `${B.width}x${B.height}` }
  }
  let pixels = 0
  let x0 = A.width, y0 = A.height, x1 = -1, y1 = -1
  const out = diffDir ? Buffer.alloc(A.data.length) : null
  for (let i = 0; i < A.data.length; i += 4) {
    const same = A.data[i] === B.data[i] && A.data[i + 1] === B.data[i + 1]
      && A.data[i + 2] === B.data[i + 2] && A.data[i + 3] === B.data[i + 3]
    if (same) {
      // Unchanged pixels are shown faded so the changed ones stand out.
      if (out) { out[i] = out[i + 1] = out[i + 2] = 255 - Math.round((255 - A.data[i]!) * 0.15); out[i + 3] = 255 }
      continue
    }
    pixels++
    const p = i / 4
    const x = p % A.width
    const y = (p - x) / A.width
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
    if (out) { out[i] = 255; out[i + 1] = 0; out[i + 2] = 0; out[i + 3] = 255 }
  }
  if (pixels === 0) return { name, kind: 'identical' }
  if (diffDir && out) {
    mkdirSync(diffDir, { recursive: true })
    await sharp(out, { raw: { width: A.width, height: A.height, channels: 4 } }).png().toFile(join(diffDir, name))
  }
  return { name, kind: 'differs', pixels, box: [x0, y0, x1, y1] }
}

/** Returns the process exit code: 0 only when every image is identical and none is missing. */
export async function compareDirs(dirA: string, dirB: string, diffDir: string | null): Promise<number> {
  const a = pngs(dirA)
  const b = pngs(dirB)
  const names = [...new Set([...a, ...b])].sort()
  if (names.length === 0) { console.error(`compare: no PNG files in ${dirA} or ${dirB}`); return 1 }
  const verdicts: Verdict[] = []
  for (const name of names) {
    if (!a.includes(name)) verdicts.push({ name, kind: 'missing', side: 'A' })
    else if (!b.includes(name)) verdicts.push({ name, kind: 'missing', side: 'B' })
    else verdicts.push(await one(name, join(dirA, name), join(dirB, name), diffDir))
  }
  const bad = verdicts.filter((v) => v.kind !== 'identical')
  for (const v of bad) {
    if (v.kind === 'missing') console.log(`MISSING in ${v.side}  ${v.name}`)
    else if (v.kind === 'size') console.log(`SIZE       ${v.name}  A ${v.a}  B ${v.b}`)
    else if (v.kind === 'differs') console.log(`DIFFERS    ${v.name}  ${v.pixels} px  box x${v.box[0]}-${v.box[2]} y${v.box[1]}-${v.box[3]}`)
  }
  console.log(`${verdicts.length - bad.length}/${verdicts.length} identical, ${bad.length} not`
    + (diffDir && bad.some((v) => v.kind === 'differs') ? `  (diff images in ${diffDir})` : ''))
  return bad.length === 0 ? 0 : 1
}
