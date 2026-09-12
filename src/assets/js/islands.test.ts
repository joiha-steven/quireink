// The islands, driven against a real DOM.
//
// Browser code is the one part of the server that `bun test` cannot reach by making a
// request, so without this file the only evidence that any of it runs is that the bundler
// accepted the syntax. happy-dom is registered for THIS FILE ONLY (`unregister` in
// `afterAll`): registering globally would hand the router tests happy-dom's `fetch` and
// `Response` instead of Bun's.

import { beforeEach, describe, expect, it } from 'bun:test'
import { backToTop } from './back-to-top'
import { codeCopy } from './code-copy'
import { lightbox } from './lightbox'
import { toc } from './toc'
import { page, useDom } from './test-dom'

// The island modules touch `document` when CALLED, never at import time, so importing
// them above the registration is safe. That is a property worth keeping: a module that
// read the DOM at import time would run at speculation time in a prerendered page.
useDom()

const LABELS = {
  copyCode: 'Copy',
  copiedCode: 'Copied',
  backToTop: 'Back to top',
  lightboxPrev: 'Previous image',
  lightboxNext: 'Next image',
  lightboxClose: 'Close',
}

const frame = () => new Promise((r) => requestAnimationFrame(r))

/** Pretend the document is `height` tall and the reader is `y` pixels down it. */
function scrolledTo(y: number, height: number, viewport = 800): void {
  const doc = document.documentElement
  Object.defineProperty(doc, 'scrollHeight', { value: height, configurable: true })
  Object.defineProperty(doc, 'clientHeight', { value: viewport, configurable: true })
  Object.defineProperty(doc, 'scrollTop', { value: y, configurable: true })
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: viewport, configurable: true })
  window.dispatchEvent(new Event('scroll'))
}

beforeEach(() => page('', LABELS))

describe('code copy', () => {
  it('adds one button per code block, and adding it twice adds one', () => {
    page('<div class="prose"><pre><code>one</code></pre><pre><code>two</code></pre></div>', LABELS)
    codeCopy()
    codeCopy()
    expect(document.querySelectorAll('.code-copy').length).toBe(2)
  })

  it('copies the code, says so, and goes back to saying "Copy"', async () => {
    page('<div class="prose"><pre><code>bun test</code></pre></div>', LABELS)
    let written = ''
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (s: string) => { written = s; return Promise.resolve() } },
      configurable: true,
    })

    codeCopy()
    const btn = document.querySelector<HTMLButtonElement>('.code-copy')!
    expect(btn.textContent).toBe('Copy')
    btn.click()
    await Promise.resolve()
    expect(written).toBe('bun test')
    expect(btn.textContent).toBe('Copied')
    await new Promise((r) => setTimeout(r, 1600))
    expect(btn.textContent).toBe('Copy')
  })

  it('does nothing on a page with no code', () => {
    page('<div class="prose"><p>words</p></div>', LABELS)
    codeCopy()
    expect(document.querySelector('.code-copy')).toBeNull()
  })
})

// The reading-progress bar has no test here because it has no JavaScript: it is markup the
// server emits and a scroll-driven CSS animation. That it appears at all is covered by the
// router tests; that it moves is the browser's job, not this bundle's.

describe('back to top', () => {
  it('appears only once the reader is past the first viewport', async () => {
    page('<article>x</article>', LABELS)
    backToTop()
    const btn = document.querySelector<HTMLButtonElement>('.to-top')!
    expect(btn.getAttribute('aria-label')).toBe('Back to top')

    scrolledTo(200, 4000)
    await frame()
    expect(btn.classList.contains('shown')).toBe(false)

    scrolledTo(900, 4000) // past one 800px viewport
    await frame()
    expect(btn.classList.contains('shown')).toBe(true)
  })
})

describe('lightbox', () => {
  const gallery = `<div class="prose">
    <figure><img src="/a.jpg" alt="First"></figure>
    <figure><img src="/b.jpg" alt="Second"></figure>
    <p><img src="/inline.jpg" alt="Not in a figure"></p>
  </div>`

  const openFirst = () => {
    lightbox()
    document.querySelector<HTMLImageElement>('.prose figure img')!.click()
    return document.querySelector<HTMLDialogElement>('.lightbox')!
  }

  it('opens as a modal dialog, showing its position in the set', () => {
    page(gallery, LABELS)
    const overlay = openFirst()
    expect(overlay).not.toBeNull()
    // A modal dialog, not a div: Escape, focus trapping and the inert background all come
    // from the browser rather than from this file.
    expect(overlay.tagName).toBe('DIALOG')
    expect(overlay.open).toBe(true)
    expect(overlay.querySelector<HTMLImageElement>('.lightbox-img')!.src).toContain('/a.jpg')
    expect(overlay.querySelector('.lightbox-caption')!.textContent).toBe('First')
    expect(overlay.querySelector('.lightbox-count')!.textContent).toBe('1 / 2')
  })

  it('ignores an image that is not in a figure', () => {
    page(gallery, LABELS)
    lightbox()
    document.querySelectorAll<HTMLImageElement>('.prose img')[2]!.click()
    expect(document.querySelector('.lightbox')).toBeNull()
  })

  it('wraps around at both ends with the arrow keys, in one dialog', () => {
    page(gallery, LABELS)
    const overlay = openFirst()
    const shown = () => document.querySelector<HTMLImageElement>('.lightbox-img')!.src

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(shown()).toContain('/b.jpg')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(shown()).toContain('/a.jpg') // past the end, back to the start
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    expect(shown()).toContain('/b.jpg') // and before the start, round to the end
    // Navigating swaps the picture inside the dialog rather than replacing the dialog:
    // rebuilding it would drop focus and re-run `showModal` on every arrow press.
    expect(document.querySelectorAll('.lightbox').length).toBe(1)
    expect(overlay.open).toBe(true)
  })

  it('tears down on close, however it was closed, and restores scrolling', () => {
    page(gallery, LABELS)
    const overlay = openFirst()
    expect(document.body.style.overflow).toBe('hidden')
    // The browser fires `close` for Escape and for the buttons alike, which is why the
    // teardown is written once and hung off the event rather than off each path.
    overlay.close()
    expect(document.querySelector('.lightbox')).toBeNull()
    expect(document.body.style.overflow).toBe('')
    // A stale keydown handler would throw, or move a viewer that is no longer there.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(document.querySelector('.lightbox')).toBeNull()
  })

  it('closes on the close button', () => {
    page(gallery, LABELS)
    const overlay = openFirst()
    overlay.querySelector<HTMLButtonElement>('.lightbox-close')!.click()
    expect(document.querySelector('.lightbox')).toBeNull()
  })

  it('reopens cleanly after a close', () => {
    page(gallery, LABELS)
    openFirst()
    document.querySelector<HTMLDialogElement>('.lightbox')!.close()
    document.querySelectorAll<HTMLImageElement>('.prose figure img')[1]!.click()
    const overlay = document.querySelector<HTMLDialogElement>('.lightbox')!
    expect(overlay.open).toBe(true)
    expect(overlay.querySelector('.lightbox-count')!.textContent).toBe('2 / 2')
  })

  it('leaves a single image without prev/next controls', () => {
    page('<div class="prose"><figure><img src="/only.jpg" alt="Only"></figure></div>', LABELS)
    const overlay = openFirst()
    expect(overlay.querySelector('.lightbox-prev')).toBeNull()
    expect(overlay.querySelector('.lightbox-count')).toBeNull()
  })

  it('does nothing on an article with no figures', () => {
    page('<div class="prose"><p>words</p></div>', LABELS)
    lightbox()
    expect(document.querySelector('.lightbox')).toBeNull()
  })
})

describe('table of contents', () => {
  const nav = `<nav class="toc"><ol>
    <li><a href="#one">One</a></li>
    <li><a href="#two">Two</a></li>
  </ol></nav>
  <h2 id="one">One</h2><h2 id="two">Two</h2>`

  /** Put a heading's top edge at `top` px from the top of the viewport. */
  const place = (id: string, top: number) => {
    document.getElementById(id)!.getBoundingClientRect = () => ({ top }) as DOMRect
  }

  const current = () => document.querySelector('.toc a[aria-current]')?.textContent ?? null

  it('marks the LAST heading past the reading line, not the one on screen', async () => {
    page(nav, LABELS)
    toc()

    // Both still below the line: nothing is current yet.
    place('one', 400); place('two', 900)
    scrolledTo(0, 4000)
    await frame()
    expect(current()).toBeNull()

    // "One" has passed the line and scrolled well away; "Two" has not arrived. An
    // IntersectionObserver on the headings would mark nothing here, which is the blank
    // middle-of-a-long-section this approach exists to avoid.
    place('one', -600); place('two', 900)
    scrolledTo(1000, 4000)
    await frame()
    expect(current()).toBe('One')

    place('one', -1400); place('two', -100)
    scrolledTo(1800, 4000)
    await frame()
    expect(current()).toBe('Two')
  })

  it('never marks the end row, whose target sits at the TOP of the article on a desktop', async () => {
    // The shape a desktop serves: a gutter panel holding the taxonomy at the top of the
    // piece, and the contents list's last row aimed at it rather than at the copy under the
    // article. That target passes the reading line within the first screenful, and the row is
    // last in the list — so as a section candidate it won every pass from there to the end of
    // the piece, and no heading was ever marked again. Measured 2026-09-12 at 1440: the lit
    // row moved to the end row at 165px of scroll and stayed there for the whole article.
    page(`<aside class="post-info"><span id="post-info-tags"></span></aside>
      <nav class="toc"><ol>
        <li><a href="#one">One</a></li>
        <li><a class="toc-end" href="#post-tags">Tags</a></li>
      </ol></nav>
      <h2 id="one">One</h2><span id="post-tags"></span>`, LABELS)
    toc()
    place('post-info-tags', -900)
    place('post-tags', 3000)
    place('one', -600)
    scrolledTo(1000, 4000)
    await frame()
    expect(current()).toBe('One')
  })

  it('marks exactly one row', async () => {
    page(nav, LABELS)
    toc()
    place('one', -600); place('two', -100)
    scrolledTo(1800, 4000)
    await frame()
    expect(document.querySelectorAll('.toc a[aria-current]').length).toBe(1)
  })

  it('does nothing on a page with no contents list', () => {
    page('<article>x</article>', LABELS)
    expect(() => toc()).not.toThrow()
  })
})
