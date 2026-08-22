import { describe, it, expect } from '@/test/vitest'
import { prepareFootnotes, applyFootnotes } from '@/render/footnotes'

describe('prepareFootnotes', () => {
  it('extracts a definition and numbers its reference', () => {
    const fn = prepareFootnotes('A claim[^src].\n\n[^src]: The source.')
    expect(fn.refs.get('src')).toBe(1)
    expect(fn.defs.get('src')).toBe('The source.')
    expect(fn.markdown).not.toContain('[^src]: The source.') // definition line removed
    expect(fn.markdown).not.toContain('[^src]') // reference swapped for a placeholder
  })

  it('numbers by first reference appearance', () => {
    const fn = prepareFootnotes('X[^b] then Y[^a].\n\n[^a]: A\n[^b]: B')
    expect(fn.refs.get('b')).toBe(1)
    expect(fn.refs.get('a')).toBe(2)
  })

  it('leaves a reference with no definition as literal text', () => {
    const fn = prepareFootnotes('Dangling[^x] ref.')
    expect(fn.refs.size).toBe(0)
    expect(fn.markdown).toContain('[^x]')
  })

  it('drops a definition that is never referenced', () => {
    const fn = prepareFootnotes('No refs here.\n\n[^unused]: orphan')
    expect(fn.defs.size).toBe(0)
  })

  it('ignores a [^id] inside a fenced code block', () => {
    const fn = prepareFootnotes('```\narr[^0]\n```\n\n[^0]: def')
    expect(fn.refs.size).toBe(0) // the only [^0] is inside code
    expect(fn.markdown).toContain('arr[^0]') // code preserved verbatim
  })
})

describe('applyFootnotes', () => {
  it('is a no-op with no footnotes', () => {
    expect(applyFootnotes('<p>hi</p>', new Map(), new Map())).toBe('<p>hi</p>')
  })

  it('renders sup refs + a list, round-tripped through prepare', () => {
    const fn = prepareFootnotes('A[^s].\n\n[^s]: **bold** note')
    // marked would leave the placeholder in place inside a paragraph; simulate that.
    const html = applyFootnotes(`<p>A${fn.markdown.match(/A([\s\S]*?)\./)?.[1] ?? ''}.</p>`, fn.refs, fn.defs)
    expect(html).toContain('sup class="fnref" id="fnref-s"')
    expect(html).toContain('href="#fn-s"')
    expect(html).toContain('<li id="fn-s">')
    expect(html).toContain('<strong>bold</strong>') // definition markdown rendered
    expect(html).toContain('href="#fnref-s"') // back-reference
  })
})
