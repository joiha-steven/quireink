// SVG in a theme (A4): only static drawing elements and attributes, internal references only,
// read in linear time. The review's four bypasses of the old deny list are cases here.
import { describe, expect, it } from 'bun:test'
import { checkThemeFiles } from '@/theme/check-files'
import { svgFinding } from '@/theme/check-svg'

const find = (t: string) => svgFinding(new TextEncoder().encode(t))

describe('A4: what an SVG may hold', () => {
  it('accepts a static drawing with gradients, clips, symbols, text and internal references', () => {
    expect(find([
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!-- drawn by hand -->',
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10">',
      '<title>Mark</title><desc>A mark &amp; a line</desc>',
      '<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient>',
      '<clipPath id="c"><rect width="5" height="5"/></clipPath><symbol id="s"><circle r="1"/></symbol></defs>',
      '<g clip-path="url(#c)" fill="url(#g)" xml:space="preserve"><use href="#s"/><use xlink:href="#s"/>',
      "<path d='M0 0L10 10'/><text x='1'>A<tspan>b</tspan></text></g>",
      '</svg>',
    ].join('\n'))).toBeNull()
  })

  it('refuses the review bypasses: prefixed script, style element, animation, style attribute', () => {
    expect(find('<svg xmlns="http://www.w3.org/2000/svg" xmlns:s="http://www.w3.org/2000/svg"><s:script>x</s:script></svg>'))
      .toBe('xmlns:s')
    expect(find('<svg xmlns="http://www.w3.org/2000/svg"><style>svg{background-image:image-set("https://e.example/t.png" 1x)}</style></svg>'))
      .toBe('<style')
    expect(find('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10"><set attributeName="onclick" to="alert(1)"/></rect></svg>'))
      .toBe('<set')
    expect(find(`<svg xmlns="http://www.w3.org/2000/svg"><rect style="background:image-set('https://e.example/u.png' 1x)"/></svg>`))
      .toBe('style')
  })

  it('refuses every element outside the list, prefixed elements, and unknown closing tags', () => {
    for (const tag of ['script', 'SCRIPT', 'foreignObject', 'iframe', 'embed', 'object', 'image', 'a', 'animate', 'feImage', 'svg:script']) {
      expect(find(`<svg><${tag}/></svg>`)).toBe(`<${tag}`)
    }
    expect(find('<svg></script></svg>')).toBe('</script')
  })

  it('refuses DOCTYPE, ENTITY, CDATA, processing instructions and malformed comments', () => {
    expect(find('<!DOCTYPE svg><svg/>')).toBe('<!DOCTYPE sv')
    expect(find('<svg><![CDATA[x]]></svg>')).toBe('<![CDATA[x]]')
    expect(find('<?xml-stylesheet href="x.css"?><svg/>')).toBe('<?xml-styles')
    expect(find('<?xml version="1.0"?><?pi x?><svg/>')).toBe('<?pi x?><svg')
    expect(find('<svg><!-- a -- b --></svg>')).toBe('--')
    expect(find('<svg><!-- a ---></svg>')).toBe('--')
    expect(find('<svg><!-- a </svg>')).toBe('<!--')
  })

  it('accepts the XML declaration only first, and only as UTF-8', () => {
    expect(find('<?xml version="1.0" encoding="utf8"?><svg/>')).toBeNull()
    expect(find('<?xml version="1.0" encoding="ISO-8859-1"?><svg/>')).toBe('encoding="ISO-8859-1"')
    expect(find(' <?xml version="1.0"?><svg/>')).toBe('<?xml versio')
  })

  it('refuses handlers, style, foreign namespaces and links out', () => {
    expect(find('<svg onload="x"/>')).toBe('onload')
    expect(find('<svg><g ONCLICK="x"/></svg>')).toBe('ONCLICK')
    expect(find('<svg xmlns="http://www.w3.org/1999/xhtml"/>')).toBe('xmlns=http://www.w3.org/1999/xhtml')
    expect(find('<svg xmlns:q="http://www.w3.org/1999/xlink"><use q:href="#a"/></svg>')).toBe('xmlns:q')
    expect(find('<svg><use href="other.svg#a"/></svg>')).toBe('href=other.svg#a')
    expect(find('<svg><use xlink:href="javascript:alert(1)"/></svg>')).toBe('xlink:href=javascript:alert(1)')
    expect(find('<svg><use xml:base="https://e.example/"/></svg>')).toBeNull()
    expect(find('<svg><use xlink:show="new"/></svg>')).toBe('xlink:show')
  })

  it('refuses values that fetch or could spell a fetch', () => {
    const cases: [string, string][] = [
      ['fill="url(https://e.example/#a)"', 'url(https://e.example/#a)'],
      ["fill=\"url('#a')\"", "url('#a')"],
      ['fill="image-set(x)"', 'image-set'],
      ['fill="image(x)"', 'image('],
      ['fill="u&#114;l(x)"', '&#'],
      ['fill="u\\72l(x)"', '\\'],
      ['fill="javascript:x"', 'javascript:'],
      ['fill="data:x"', 'data:'],
    ]
    for (const [attr, subject] of cases) expect(find(`<svg><rect ${attr}/></svg>`)).toBe(subject)
  })

  it('refuses unquoted values, attributes run together and an unclosed tag', () => {
    expect(find('<svg><rect width=10/></svg>')).toBe('width')
    expect(find('<svg><rect width="1"height="2"/></svg>')).toBe('height="2"/></svg>')
    expect(find('<svg><rect width="1"')).toBe('unclosed tag')
  })

  it('refuses other encodings, BOMs and NUL before reading a tag', () => {
    expect(svgFinding(new Uint8Array([0xff, 0xfe, 0x3c, 0x00]))).toBe('BOM')
    expect(svgFinding(new Uint8Array([0xef, 0xbb, 0xbf, 0x3c]))).toBe('BOM')
    expect(svgFinding(new Uint8Array([0x3c, 0xc3, 0x28]))).toBe('not utf-8')
    expect(find('<\0s\0v\0g\0>')).toBe('NUL')
  })

  it('reports through checkThemeFiles as A4 on the file', () => {
    const bytes = new TextEncoder().encode('<svg><script/></svg>')
    const out = checkThemeFiles([
      { path: 'images/a.svg', size: bytes.length, bytes },
    ]).filter((v) => v.file === 'images/a.svg')
    expect(out).toEqual([{ rule: 'A4', file: 'images/a.svg', line: 0, col: 0, subject: '<script' }])
  })
})

describe('A4: linear time on hostile input', () => {
  // The old `<?xml ... encoding` regex took 31 s on 384 KB of `<?xml ` repeated.
  const MB = 1 << 20
  const worst: [string, string][] = [
    ['unclosed declarations', `<?xml ${'<?xml '.repeat(MB / 6)}`],
    ['declarations after a tag', `<svg>${'<?xml '.repeat(MB / 6)}`],
    ['angle brackets', '<'.repeat(MB)],
    ['quotes in text', `<svg>${'"'.repeat(MB)}`],
    ['quotes in a tag', `<svg a="b" ${'c'.repeat(MB)}`],
    ['comment openers', '<!--'.repeat(MB / 4)],
    ['url( in a value', `<svg><rect fill="${'url('.repeat(MB / 4)}"/></svg>`],
  ]
  for (const [name, input] of worst) {
    it(`checks 1 MB of ${name} in under 200 ms`, () => {
      const bytes = new TextEncoder().encode(input)
      const t = performance.now()
      svgFinding(bytes)
      expect(performance.now() - t).toBeLessThan(200)
    })
  }
})
