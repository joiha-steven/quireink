// Building DOM for a plain ProseMirror node view.
//
// ⚠️ `className:` BY NAME, not a bare positional argument, and `check:admin-css` is why. That
// guard reads every class this admin writes and proves the stylesheet has a rule for it — and
// it can only see a class it can NAME. Passed positionally, a whole file's chrome went
// invisible to it: the count fell by one and the check stayed green (2026-09-15), which is what
// a guard that has quietly stopped checking looks like. One helper, so the rule is stated once
// and every node view inherits it.
export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K, opts: { className?: string } & Record<string, string> = {},
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  const { className, ...attrs } = opts
  if (className) node.className = className
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  return node
}

/**
 * An SVG from the shared icon set, or from paths written at the call site.
 *
 * ⚠️ The bodies are module CONSTANTS from our own files — no request data ever passes through
 * this, which is what makes `innerHTML` ordinary here rather than a hole. The same argument the
 * React set makes for `dangerouslySetInnerHTML` in `navIcons.tsx`.
 */
export function svgGlyph(body: string, cls: string, stroke = '1.8'): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  for (const [k, v] of Object.entries({
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': stroke,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: cls,
  })) svg.setAttribute(k, v)
  svg.innerHTML = body
  return svg
}
