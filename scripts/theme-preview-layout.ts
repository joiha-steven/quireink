// The layout checks `theme:preview` runs on every page it photographs. Two halves on purpose:
// MEASURE runs in the page and only reports what the browser laid out, and `layoutFindings`
// (plain TypeScript, tested on measurements written by hand) decides what of that is a finding.
// So what counts as a problem can be read and tested without a browser.
//
// What it finds, and what it leaves alone because the page does it on purpose:
//  - overflow: the document is wider than the viewport, so the reader can scroll sideways.
//  - past-edge: a visible element whose box reaches past the left or right edge of the viewport.
//    Not one inside a box that clips or scrolls sideways (a wide code block or table scrolls in
//    its own frame), not the visually-hidden pattern (1px boxes, `clip`, `clip-path`), and only the
//    outermost of a nest, since every child of a too-wide box is too wide as well.
//  - clipped-text: text laid out outside a box with `overflow: hidden` or `clip`, so part of it is
//    cut. Not where the engine truncates on purpose (`line-clamp`, `text-overflow: ellipsis`), not
//    the visually-hidden pattern, and not text in CSS columns (book mode's pages beside the one shown).
//  - broken-image: an `<img>` that loaded nothing.
//  - font-failed: a face in `document.fonts` that the browser tried and failed to load.

export type EdgeBox = {
  /** `tag#id.class` of the element and its parent, enough to find it in the markup. */
  where: string
  left: number
  right: number
  width: number
  height: number
  /** Inside an ancestor (below `<body>`) that clips or scrolls sideways. */
  insideClip: boolean
  /** An ancestor is itself past the edge. */
  parentPast: boolean
  /** `clip` or `clip-path` set: the visually-hidden pattern. */
  clipped: boolean
}

export type ClipBox = {
  where: string
  /** How far laid-out text reaches past the box, in px, the larger of the four sides. */
  overBy: number
  clientWidth: number
  clientHeight: number
  /** Computed `-webkit-line-clamp`: 'none' unless the engine clamps on purpose. */
  lineClamp: string
  textOverflow: string
  clipped: boolean
  /** The first words of the text that is cut. */
  text: string
}

export type Measurement = {
  viewport: number
  scrollWidth: number
  /** `data-theme` on `<html>`: the theme the page is actually wearing. */
  theme: string
  edges: EdgeBox[]
  clips: ClipBox[]
  brokenImages: string[]
  failedFonts: string[]
}

/** `http-status` is added by the runner, not by `layoutFindings`: a page that answered with the wrong status. */
export type FindingKind = 'overflow' | 'past-edge' | 'clipped-text' | 'broken-image' | 'font-failed' | 'http-status'
export type LayoutFinding = { kind: FindingKind; detail: string }

/** Sub-pixel rounding is not a finding: a box at 375.4 in a 375 viewport draws nothing outside it. */
const TOLERANCE = 1

const visuallyHidden = (b: { width?: number; height?: number; clientWidth?: number; clientHeight?: number; clipped: boolean }): boolean =>
  b.clipped || (b.width ?? b.clientWidth ?? 2) <= 1 || (b.height ?? b.clientHeight ?? 2) <= 1

export function layoutFindings(m: Measurement): LayoutFinding[] {
  const out: LayoutFinding[] = []
  if (m.scrollWidth > m.viewport + TOLERANCE) {
    out.push({ kind: 'overflow', detail: `the page is ${m.scrollWidth}px wide in a ${m.viewport}px viewport` })
  }
  for (const b of m.edges) {
    if (b.insideClip || b.parentPast || visuallyHidden(b)) continue
    const pastRight = b.right - m.viewport
    const pastLeft = -b.left
    if (pastRight <= TOLERANCE && pastLeft <= TOLERANCE) continue
    const side = pastRight > TOLERANCE ? `${Math.round(pastRight)}px past the right edge` : `${Math.round(pastLeft)}px past the left edge`
    out.push({ kind: 'past-edge', detail: `${b.where} reaches ${side}` })
  }
  for (const c of m.clips) {
    if (visuallyHidden(c) || c.overBy <= TOLERANCE) continue
    if (c.lineClamp !== 'none' && c.lineClamp !== '') continue
    if (c.textOverflow === 'ellipsis') continue
    out.push({ kind: 'clipped-text', detail: `${c.where} cuts ${Math.round(c.overBy)}px of "${c.text}"` })
  }
  for (const src of m.brokenImages) out.push({ kind: 'broken-image', detail: `${src} did not load` })
  for (const face of m.failedFonts) out.push({ kind: 'font-failed', detail: `${face} failed to load` })
  return out
}

/**
 * Runs in the page, after it has settled (fonts ready, images decoded). Answers a `Measurement`.
 * The lists are capped so a page that is wrong everywhere still answers quickly; the cap is far
 * above what any one finding needs.
 */
export const MEASURE = `(() => {
  const html = document.documentElement;
  const vw = html.clientWidth;
  const name = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '')
    + [...el.classList].slice(0, 2).map((c) => '.' + c).join('');
  const where = (el) => (el.parentElement && el.parentElement !== document.body ? name(el.parentElement) + ' > ' : '') + name(el);
  const clipsX = (s) => /hidden|clip|auto|scroll/.test(s.overflowX);
  const hasClip = (s) => (s.clip && s.clip !== 'auto') || (s.clipPath && s.clipPath !== 'none');
  const past = new Set();
  const edges = [];
  const clips = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (edges.length >= 200 && clips.length >= 200) break;
    if (!el.checkVisibility({ visibilityProperty: true })) continue;
    const r = el.getBoundingClientRect();
    // Wholly left of the viewport is the parked skip link (left:-9999px): nobody can scroll there.
    if ((r.width === 0 && r.height === 0) || r.right <= 0) continue;
    const s = getComputedStyle(el);
    if ((r.right > vw + 1 || r.left < -1) && edges.length < 200) {
      let insideClip = false;
      let parentPast = false;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        if (past.has(a)) parentPast = true;
        if (clipsX(getComputedStyle(a))) insideClip = true;
      }
      past.add(el);
      edges.push({ where: where(el), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width),
        height: Math.round(r.height), insideClip, parentPast, clipped: hasClip(s) });
    }
    if (/hidden|clip/.test(s.overflowX + ' ' + s.overflowY) && clips.length < 200) {
      const box = el.getBoundingClientRect();
      const cutX = /hidden|clip/.test(s.overflowX);
      const cutY = /hidden|clip/.test(s.overflowY);
      let over = 0;
      let cut = '';
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        if (!t.textContent.trim() || !t.parentElement.checkVisibility({ visibilityProperty: true })) continue;
        // Text inside a nearer box that clips or scrolls is that box's to judge, not this one's; text
        // in CSS columns is paged (book mode lays the next pages beside the one shown), not cut.
        let owner = t.parentElement;
        let paged = false;
        for (;; owner = owner.parentElement) {
          const os = getComputedStyle(owner);
          if (os.columnWidth !== 'auto' || os.columnCount !== 'auto') paged = true;
          if (owner === el || os.overflowX !== 'visible' || os.overflowY !== 'visible') break;
        }
        if (owner !== el || paged) continue;
        const range = document.createRange();
        range.selectNodeContents(t);
        for (const tr of range.getClientRects()) {
          // Per axis: past a side that scrolls (a row of chips, overflow-x:auto) the reader can scroll to it.
          const by = Math.max(cutX ? Math.max(tr.right - box.right, box.left - tr.left) : 0,
            cutY ? Math.max(tr.bottom - box.bottom, box.top - tr.top) : 0);
          if (by > over) { over = by; cut = t.textContent.trim().replace(/\\s+/g, ' ').slice(0, 40); }
        }
      }
      if (over > 1) clips.push({ where: where(el), overBy: Math.round(over), clientWidth: el.clientWidth, clientHeight: el.clientHeight,
        lineClamp: s.webkitLineClamp || 'none', textOverflow: s.textOverflow, clipped: hasClip(s), text: cut });
    }
  }
  const brokenImages = [...document.images].filter((i) => (i.currentSrc || i.src) && i.complete && i.naturalWidth === 0)
    .map((i) => i.currentSrc || i.src);
  // Only faces fetched from a URL. The engine's metric fallbacks ('Literata Fallback 2') are
  // local() faces for fonts a given machine may not have, and failing is how they say so.
  const fetched = new Set();
  const walk = (rules) => { for (const rule of rules) {
    if (rule instanceof CSSFontFaceRule) {
      if (/url\\(/.test(rule.style.getPropertyValue('src'))) fetched.add(rule.style.getPropertyValue('font-family').replace(/["']/g, '').trim());
    } else if (rule.cssRules) walk(rule.cssRules);
  } };
  for (const sheet of document.styleSheets) { try { walk(sheet.cssRules); } catch { /* another origin's sheet */ } }
  const failedFonts = [...document.fonts].filter((f) => f.status === 'error' && fetched.has(f.family.replace(/["']/g, '').trim()))
    .map((f) => f.family.replace(/["']/g, '') + ' ' + f.weight + ' ' + f.style);
  return { viewport: vw, scrollWidth: Math.max(html.scrollWidth, document.body.scrollWidth), theme: html.dataset.theme || '',
    edges, clips, brokenImages, failedFonts };
})()`

/** A value the page answered, held to the shape `layoutFindings` reads, or an error saying what is off. */
export function asMeasurement(value: unknown): Measurement {
  const v = value as Partial<Measurement> | null
  if (!v || typeof v.viewport !== 'number' || typeof v.scrollWidth !== 'number' || !Array.isArray(v.edges)
    || !Array.isArray(v.clips) || !Array.isArray(v.brokenImages) || !Array.isArray(v.failedFonts) || typeof v.theme !== 'string') {
    throw new Error(`the layout measurement came back in an unexpected shape: ${JSON.stringify(value).slice(0, 200)}`)
  }
  return v as Measurement
}
