// The pen answering the hand (ADR 0049): a mark just applied is the only thing that sweeps.
//
// happy-dom for THIS FILE ONLY, the island rule.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

async function open(content: string) {
  const { Editor } = await import('@tiptap/core')
  const { editorExtensions } = await import('@/admin/components/editorExtensions')
  const host = document.createElement('div')
  document.body.appendChild(host)
  return new Editor({ element: host, extensions: editorExtensions(''), content })
}

const tick = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

describe('penStepsOf', () => {
  it('names the gesture and range of every pen mark a transaction adds, and nothing else', async () => {
    const { penStepsOf } = await import('@/admin/components/pen-feedback')
    const editor = await open('a reed pen, cut to a broad edge')
    editor.commands.setTextSelection({ from: 3, to: 11 })
    let tr = editor.state.tr
    editor.on('transaction', ({ transaction }) => { tr = transaction })
    editor.commands.toggleInk('green')
    expect(penStepsOf(tr)).toEqual([{ kind: 'hl', from: 3, to: 11 }])
    editor.commands.setTextSelection({ from: 13, to: 16 })
    editor.commands.toggleUnderline()
    expect(penStepsOf(tr)).toEqual([{ kind: 'u', from: 13, to: 16 }])
    editor.commands.setTextSelection({ from: 20, to: 25 })
    editor.commands.toggleRing()
    expect(penStepsOf(tr)).toEqual([{ kind: 'o', from: 20, to: 25 }])
    editor.commands.setTextSelection({ from: 26, to: 30 })
    editor.commands.toggleBold()
    expect(penStepsOf(tr)).toEqual([])
    editor.commands.insertContent('x')
    expect(penStepsOf(tr)).toEqual([])
    editor.destroy()
  })
})

describe('penStrokes', () => {
  it('puts the class on the element the mark became, for a beat', async () => {
    const { penStrokes } = await import('@/admin/components/pen-feedback')
    const editor = await open('a reed pen, cut to a broad edge')
    editor.commands.setTextSelection({ from: 3, to: 11 })
    editor.on('transaction', ({ transaction }) => penStrokes(editor.view, transaction, { mode: 'off', volume: 0 }))
    editor.commands.toggleInk('pink')
    await tick()
    const mark = editor.view.dom.querySelector('mark')
    expect(mark?.textContent).toBe('reed pen')
    expect(mark?.classList.contains('pen-fresh')).toBe(true)
    await new Promise((r) => setTimeout(r, 360))
    expect(mark?.classList.contains('pen-fresh')).toBe(false)
    editor.destroy()
  })

  it('leaves a document that opens full of marks alone', async () => {
    const { penStrokes } = await import('@/admin/components/pen-feedback')
    const editor = await open('a ==reed pen==, ++cut++ to a broad edge')
    editor.on('transaction', ({ transaction }) => penStrokes(editor.view, transaction, { mode: 'off', volume: 0 }))
    editor.commands.setTextSelection({ from: 5, to: 5 })
    editor.commands.insertContent('x')
    await tick()
    expect(editor.view.dom.querySelectorAll('.pen-fresh')).toHaveLength(0)
    editor.destroy()
  })
})
