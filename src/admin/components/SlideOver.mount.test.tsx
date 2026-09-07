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
})
