// The upload zone is a control, not a picture of one.
//
// It was a div with an onClick in front of a hidden file input, copied into both uploaders.
// Tab went past it, Enter did nothing, and the only way to add a file was a pointer.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

describe('Dropzone', () => {
  it('is a button, so a keyboard can open the picker', async () => {
    const { mountAdmin } = await import('@/admin/test-mount')
    const { Dropzone } = await import('@/admin/ui/Dropzone')

    let opened = 0
    const m = await mountAdmin(<Dropzone label="Drop images here" progress={null} onFiles={() => {}} />)
    const zone = m.container.querySelector('button') as HTMLButtonElement
    expect(zone.textContent).toBe('Drop images here')

    // The file input stays out of the button and out of the tab order; the button opens it.
    const picker = m.container.querySelector('input[type=file]') as HTMLInputElement
    expect(zone.contains(picker)).toBe(false)
    picker.click = () => { opened++ }
    await m.click(zone)
    expect(opened).toBe(1)
    await m.unmount()
  })

  it('reports how far an upload has got', async () => {
    const { mountAdmin } = await import('@/admin/test-mount')
    const { Dropzone } = await import('@/admin/ui/Dropzone')

    const m = await mountAdmin(<Dropzone label="Drop" progress={40} onFiles={() => {}} />)
    const bar = m.container.querySelector('[role=progressbar]')
    expect(bar?.getAttribute('aria-valuenow')).toBe('40')
    await m.unmount()
  })
})
