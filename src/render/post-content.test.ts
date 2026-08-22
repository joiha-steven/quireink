import { describe, it, expect } from 'bun:test'
import { renderPostContent } from '@/render/post-content'
import { extractHeadings } from '@/utils'

// Moved from the frozen tree's `components/blog/post-content.test.ts`. Every assertion
// below is unchanged; only this helper is, because the renderer returns the HTML string
// directly instead of a React element wrapping it in dangerouslySetInnerHTML. Markdown
// WITHOUT code fences so Shiki never runs -> the test stays offline + fast.
const render = (markdown: string): Promise<string> => renderPostContent({ markdown })

describe('footnotes', () => {
  it('renders a reference as a sup link and appends the definition list', async () => {
    const html = await render('A fact[^1] worth citing.\n\n[^1]: The cited source.')
    expect(html).toContain('sup class="fnref" id="fnref-1"')
    expect(html).toContain('href="#fn-1"')
    expect(html).toContain('<section class="footnotes">')
    expect(html).toContain('<li id="fn-1">')
    expect(html).toContain('The cited source.')
    expect(html).not.toContain('[^1]') // neither the ref nor the def survives as text
  })

  it('leaves prose without footnotes unchanged (no empty list)', async () => {
    const html = await render('Just a normal paragraph.')
    expect(html).not.toContain('footnotes')
  })
})

describe('callouts', () => {
  it('turns a [!NOTE] blockquote into a labelled callout', async () => {
    const html = await render('> [!NOTE]\n> Heads up here')
    expect(html).toContain('class="callout callout-note"')
    expect(html).toContain('class="callout-label">Note<')
    expect(html).toContain('Heads up here')
    expect(html).not.toContain('[!NOTE]')
  })

  it('supports tip/warning/important/caution', async () => {
    for (const [type, label] of [['TIP', 'Tip'], ['WARNING', 'Warning'], ['IMPORTANT', 'Important'], ['CAUTION', 'Caution']] as const) {
      const html = await render(`> [!${type}]\n> body`)
      expect(html).toContain(`callout-${type.toLowerCase()}`)
      expect(html).toContain(`>${label}<`)
    }
  })

  it('leaves an unknown [!FOO] blockquote as a plain blockquote', async () => {
    const html = await render('> [!FOO]\n> body')
    expect(html).toContain('<blockquote>')
    expect(html).not.toContain('callout')
  })

  it('leaves an ordinary blockquote untouched', async () => {
    const html = await render('> just a quote')
    expect(html).toContain('<blockquote>')
    expect(html).not.toContain('callout')
  })
})

describe('markdown render — security', () => {
  it('escapes raw HTML instead of executing it (<script> shown as text)', async () => {
    const html = await render('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })

  it('renders an onerror <img> inert (escaped), not a live tag', async () => {
    const html = await render('<img src=x onerror=alert(1)>')
    expect(html).toContain('&lt;img')
    expect(html).not.toMatch(/<img[^>]*onerror/)
  })

  it('neutralizes a javascript: link href to #', async () => {
    const html = await render('[click me](javascript:alert(1))')
    expect(html).toContain('href="#"')
    expect(html).not.toContain('javascript:')
  })
})

describe('markdown render — structure', () => {
  it('gives H2 and H3 slug ids and demotes a body H1 to H2 (the page title is the only h1)', async () => {
    const html = await render('## Hello World\n\n### Sub Section\n\n# Big Title')
    expect(html).toContain('<h2 id="hello-world">')
    expect(html).toContain('<h3 id="sub-section">')
    // A body `#` must NOT emit a second <h1>; it becomes an anchored <h2>.
    expect(html).not.toContain('<h1')
    expect(html).toContain('<h2 id="big-title">Big Title</h2>')
  })

  it('de-dupes ids for duplicate headings (foo, foo-2)', async () => {
    const html = await render('## Repeat\n\n## Repeat')
    expect(html).toContain('id="repeat"')
    expect(html).toContain('id="repeat-2"')
  })

  it('omits the id (not id="") for a heading that slugifies to empty', async () => {
    const html = await render('## !!!\n\n## Real One')
    expect(html).toContain('<h2>!!!</h2>')
    expect(html).not.toContain('id=""')
    expect(html).toContain('<h2 id="real-one">')
  })

  it('turns a standalone YouTube URL into a responsive iframe embed', async () => {
    const html = await render('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(html).toContain('<div class="video-embed">')
    expect(html).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ')
  })

  it('turns a standalone video-file URL (Library upload) into a native <video> player', async () => {
    const html = await render('/uploads/files/clip-123.mp4')
    expect(html).toContain('<div class="video-file">')
    expect(html).toContain('<video controls preload="metadata" playsinline src="/uploads/files/clip-123.mp4">')
  })

  it('does NOT build a player from a non-http(s) video-looking URL', async () => {
    // videoFileUrl requires http(s)/root-relative, so a javascript: scheme can
    // never reach a src attribute; the line stays an escaped paragraph.
    const html = await render('javascript:alert(1)//x.mp4')
    expect(html).not.toContain('<video')
  })

  it('wraps a markdown image in a <figure> with the alt as <figcaption>', async () => {
    const html = await render('![A small cat](media/cat.jpg)')
    expect(html).toContain('<figure')
    expect(html).toContain('<figcaption>A small cat</figcaption>')
  })

  it('sizes a #third image at 30% and keeps the align class beside it', async () => {
    const centred = await render('![a](media/a.jpg#third)')
    expect(centred).toContain('<figure class="img-center img-third">')
    const floated = await render('![a](media/a.jpg#left-third)')
    expect(floated).toContain('<figure class="img-left img-third">')
  })

  it('lets wide win when a fragment carries both sizes', async () => {
    const html = await render('![a](media/a.jpg#right-third-wide)')
    expect(html).toContain('<figure class="img-right img-wide">')
    expect(html).not.toContain('img-third')
  })

  it('groups 2+ consecutive #grid images into one .gallery, cols by count', async () => {
    const html = await render('![a](media/a.jpg#grid)\n\n![b](media/b.jpg#grid)\n\n![c](media/c.jpg#grid)')
    // exactly one gallery wrapper, 3 images -> 3 columns, holding all three figures
    expect(html).toContain('<div class="gallery gallery-cols-3">')
    expect(html.match(/<div class="gallery /g)).toHaveLength(1)
    expect(html.match(/<figure class="img-grid">/g)).toHaveLength(3)
  })

  it('uses a 2-column grid for a 4-image gallery (2×2)', async () => {
    const html = await render(
      '![a](a.jpg#grid)\n\n![b](b.jpg#grid)\n\n![c](c.jpg#grid)\n\n![d](d.jpg#grid)',
    )
    expect(html).toContain('<div class="gallery gallery-cols-2">')
  })

  it('leaves a lone #grid image as a normal figure (no gallery wrapper)', async () => {
    const html = await render('![solo](media/a.jpg#grid)')
    expect(html).not.toContain('class="gallery')
    expect(html).toContain('<figure class="img-grid">')
  })

  it('does not group plain (non-grid) images into a gallery', async () => {
    const html = await render('![a](media/a.jpg)\n\n![b](media/b.jpg)')
    expect(html).not.toContain('class="gallery')
  })

  it('crops every tile to the ratio the gallery asked for', async () => {
    const html = await render('![a](a.jpg#grid-1x1)\n\n![b](b.jpg#grid-1x1)')
    expect(html.match(/<figure class="img-grid g-1x1">/g)).toHaveLength(2)
  })

  it('marks a gallery whose captions are off', async () => {
    const html = await render('![a](a.jpg#grid-4x3-nocap)\n\n![b](b.jpg#grid-4x3-nocap)')
    expect(html.match(/<figure class="img-grid g-4x3 g-nocap">/g)).toHaveLength(2)
    // The alt still renders. It is hidden by CSS, not dropped, so it keeps working for a
    // screen reader and for search.
    expect(html).toContain('<figcaption>a</figcaption>')
  })

  // The grouping regex used to match `<figure class="img-grid">` exactly. Setting any
  // option appends a class, and the gallery silently stopped being a gallery: the photos
  // fell into a full-width column with no error anywhere.
  it('still groups tiles that carry gallery options', async () => {
    const html = await render('![a](a.jpg#grid-3x2)\n\n![b](b.jpg#grid-3x2)\n\n![c](c.jpg#grid-3x2)')
    expect(html).toContain('<div class="gallery gallery-cols-3">')
    expect(html.match(/<div class="gallery /g)).toHaveLength(1)
  })

  it('ignores a ratio that is not one of the three', async () => {
    const html = await render('![a](a.jpg#grid-7x5)\n\n![b](b.jpg#grid-7x5)')
    expect(html.match(/<figure class="img-grid">/g)).toHaveLength(2)
  })

  // Silence is a THIRD value, not the same as "as shot". Once a site default exists, a
  // gallery needs to be able to say "keep the proportions" out loud and disagree with it.
  it('tells "no opinion" apart from an explicit as-shot and captions-on', async () => {
    const quiet = await render('![a](a.jpg#grid)\n\n![b](b.jpg#grid)')
    expect(quiet.match(/<figure class="img-grid">/g)).toHaveLength(2)

    const loud = await render('![a](a.jpg#grid-asis-cap)\n\n![b](b.jpg#grid-asis-cap)')
    expect(loud.match(/<figure class="img-grid g-asis g-cap">/g)).toHaveLength(2)
  })
})

describe('markdown render — ToC anchors stay in sync', () => {
  it('PostContent ids match extractHeadings ids on duplicate headings', async () => {
    const md = '## Foo\n\nbody\n\n## Foo\n\n### Bar'
    const html = await render(md)
    const renderedIds = [...html.matchAll(/<h[23] id="([^"]+)"/g)].map((m) => m[1])
    const tocIds = extractHeadings(md).map((h) => h.id)
    expect(renderedIds).toEqual(tocIds)
    expect(renderedIds).toEqual(['foo', 'foo-2', 'bar'])
  })

  it('skips an unanchorable heading in both the render and the ToC', async () => {
    const md = '## Intro\n\n## ???\n\n## Outro'
    const html = await render(md)
    const renderedIds = [...html.matchAll(/<h[23] id="([^"]+)"/g)].map((m) => m[1])
    const tocIds = extractHeadings(md).map((h) => h.id)
    expect(renderedIds).toEqual(tocIds)
    expect(renderedIds).toEqual(['intro', 'outro'])
  })
})

// The link path has been scheme-checked since the port and the image path never was, so
// `![x](javascript:…)` came out as `<img src="javascript:…">`. No browser executes that,
// which is why this closed an inconsistency rather than a hole — and why it is worth
// having a test: the next person to move an image URL somewhere executable inherits the
// guard instead of the gap. Found 2026-08-22 by feeding the renderer the payloads
// directly.
describe('markdown render — an image src cannot carry a script scheme', () => {
  const srcOf = (html: string) => html.match(/<img[^>]*\bsrc="([^"]*)"/)?.[1]

  it('empties a javascript: or vbscript: image', async () => {
    expect(srcOf(await render('![i](javascript:alert(1))'))).toBe('')
    expect(srcOf(await render('![i](VBScript:alert(1))'))).toBe('')
  })

  it('never lets a script scheme reach a src, however it is spelt', async () => {
    // `java\tscript:` is not an image to marked at all — it stays literal text, which is
    // its own kind of safe. So the assertion is the OUTCOME that matters rather than the
    // route to it: no `src` anywhere in the output carries an executable scheme.
    for (const md of [
      '![i](javascript:alert(1))', '![i](JAVASCRIPT:alert(1))',
      '![i](java\tscript:alert(1))', '![i](  javascript:alert(1))',
      '![i](vbscript:msgbox(1))',
    ]) {
      const html = await render(md)
      expect(html).not.toMatch(/src="[^"]*(?:javascript|vbscript):/i)
    }
  })

  it('leaves every legitimate image exactly as it was', async () => {
    // `data:` is NOT blocked here, unlike in `safeHref`: an inline PNG is a real image, and
    // script inside an SVG does not run when the SVG is loaded as an <img>.
    expect(srcOf(await render('![i](/uploads/media/a.png)'))).toBe('/uploads/media/a.png')
    expect(srcOf(await render('![i](https://x.example/a.jpg)'))).toBe('https://x.example/a.jpg')
    expect(srcOf(await render('![i](data:image/png;base64,iVBORw0KGgo=)')))
      .toBe('data:image/png;base64,iVBORw0KGgo=')
  })
})
