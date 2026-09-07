// What a field says about a value it cannot take.
//
// Both halves are here because they answer to different clocks: the field checks ITSELF on
// blur, and the server's refusal arrives a round trip later. The rule between them is that
// the server outranks the browser — a value the browser is happy with can still be one this
// blog cannot take, and until 2026-09-07 that answer was a corner toast reading "Save
// failed" on a screen of forty controls with nothing saying which one was wrong.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

describe('a field that cannot take its value', () => {
  it('says nothing while the value is being typed, and speaks on blur', async () => {
    // NOT on every keystroke: "that is not an email address" on the second character is a
    // screen arguing with somebody who is halfway through saying it.
    const { mountAdmin } = await import('@/admin/test-mount')
    const { Input } = await import('@/admin/ui/Input')
    const { adminT } = await import('@/i18n/admin-i18n')
    const t = adminT('en')

    const m = await mountAdmin(<Input label="Count" type="number" min={1} max={10} defaultValue="1" />)
    const el = m.container.querySelector('input') as HTMLInputElement
    await m.type(el, '99')
    expect(m.text()).not.toContain(t.fieldMax.replace('{n}', '10'))
    expect(el.getAttribute('aria-invalid')).toBeNull()

    await m.blur(el)
    expect(m.text()).toContain(t.fieldMax.replace('{n}', '10'))
    expect(el.getAttribute('aria-invalid')).toBe('true')
    await m.unmount()
  })

  it('takes the range from the element, so the sentence names the real limit', async () => {
    const { mountAdmin } = await import('@/admin/test-mount')
    const { Input } = await import('@/admin/ui/Input')
    const { adminT } = await import('@/i18n/admin-i18n')
    const t = adminT('en')

    const m = await mountAdmin(<Input label="Count" type="number" min={4} max={40} defaultValue="4" />)
    const el = m.container.querySelector('input') as HTMLInputElement
    await m.type(el, '1')
    await m.blur(el)
    expect(m.text()).toContain(t.fieldMin.replace('{n}', '4'))
    await m.unmount()
  })

  it('names the field with the label and describes it with the hint and the refusal', async () => {
    // The three used to be ONE string. A `<label>` wrapped the control, so its name was the
    // caption, the explanatory sentence and the refusal read end to end, with nothing to say
    // which part was which and no way for the refusal to arrive on its own once it changed.
    const { mountAdmin } = await import('@/admin/test-mount')
    const { Input } = await import('@/admin/ui/Input')

    const m = await mountAdmin(
      <Input label="Address" note="Where the list of posts lives." defaultValue="/notes" error="A post already lives there." />,
    )
    const el = m.container.querySelector('input') as HTMLInputElement
    const label = m.container.querySelector('label') as HTMLLabelElement
    expect(label.textContent).toBe('Address')
    expect(label.htmlFor).toBe(el.id)
    expect(el.id).not.toBe('')

    const ids = (el.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)
    expect(ids).toHaveLength(2)
    const said = ids.map((id) => m.container.querySelector(`#${CSS.escape(id)}`)?.textContent)
    expect(said).toEqual(['Where the list of posts lives.', 'A post already lives there.'])
    // The refusal announces itself: it appears after the round trip that produced it.
    expect(m.container.querySelector('[role=alert]')?.textContent).toBe('A post already lives there.')
    await m.unmount()
  })

  it('lets an outside refusal outrank a value the browser is happy with', async () => {
    // The list path is the case: `/notes` is a perfectly good string, and the server still
    // refuses it because a post already lives there. Only a round trip can know.
    const { mountAdmin } = await import('@/admin/test-mount')
    const { Input } = await import('@/admin/ui/Input')

    const m = await mountAdmin(<Input label="Address" defaultValue="/notes" error="A post already lives there." />)
    const el = m.container.querySelector('input') as HTMLInputElement
    expect(el.getAttribute('aria-invalid')).toBe('true')
    expect(m.text()).toContain('A post already lives there.')
    await m.unmount()
  })
})
