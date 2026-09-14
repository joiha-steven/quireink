// The attributes sheet, as a dialog.
//
// It was an `<aside role="dialog">` and nothing else: Escape closed nothing, focus stayed
// behind it so a keyboard reader tabbed through the toolbar underneath, it went back nowhere
// on close, and the scrim was a `<button>` whose accessible name was the panel's own title
// and whose action was to dismiss it.
import { describe, expect, it, beforeAll, afterAll, afterEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const restores: (() => void)[] = []
afterEach(() => { for (const r of restores.splice(0)) r() })

describe('SlideOver', () => {
  it('says it is modal, takes focus, and hands it back', async () => {
    const { mountAdmin } = await import('@/admin/test-mount')
    const { SlideOver } = await import('@/admin/components/SlideOver')
    let closed = 0

    const opener = document.createElement('button')
    document.body.append(opener)
    restores.push(() => opener.remove())
    opener.focus()

    const m = await mountAdmin(
      <SlideOver label="Attributes" footer={null} onClose={() => { closed++ }}>
        <p>fields</p>
      </SlideOver>,
    )
    await m.flush()

    const panel = m.container.querySelector('[role=dialog]')
    expect(panel?.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(panel)

    // The scrim is not a control: no button carries the panel's own name.
    const named = [...m.container.querySelectorAll('button')]
      .filter((b) => b.getAttribute('aria-label') === 'Attributes')
    expect(named).toHaveLength(0)

    dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(closed).toBe(1)

    await m.unmount()
    expect(document.activeElement).toBe(opener)
  })

  // ⚠️ THE ONE THAT COST THE MOST. Every field in the attributes sheet threw the keyboard
  // away after a single keystroke: type one digit into the publish time, and the caret was
  // gone. The cause is here rather than in the field — the focus effect listed `onClose` as
  // a dependency, and all three editors pass it as an inline arrow, so it was a new function
  // on every render. A keystroke changes the draft, the draft re-renders the editor, the
  // effect tore down and set up again, and setting up means `panel.focus()`.
  //
  // The test is the re-render, not the keystroke: any parent re-render at all must leave the
  // keyboard where the writer put it.
  it('leaves the keyboard where it was when the page around it re-renders', async () => {
    const { mountAdmin } = await import('@/admin/test-mount')
    const { SlideOver } = await import('@/admin/components/SlideOver')

    // A FRESH arrow every call, which is exactly what PostForm/PageForm/NoteForm pass.
    const sheet = () => (
      <SlideOver label="Attributes" footer={null} onClose={() => {}}>
        <input aria-label="Time" defaultValue="09:00" />
      </SlideOver>
    )

    const m = await mountAdmin(sheet())
    await m.flush()

    const field = m.container.querySelector('input')
    expect(field).toBeTruthy()
    field?.focus()
    expect(document.activeElement).toBe(field)

    await m.rerender(sheet())
    expect(document.activeElement).toBe(field)

    await m.unmount()
  })
})
