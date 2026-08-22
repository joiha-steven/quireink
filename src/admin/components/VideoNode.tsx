// Editor node for an embedded video. Stored in Markdown as a bare URL on its own
// line (so content stays 100% Markdown); shown here as a responsive embed. The
// public renderer turns the same URL into an iframe.
import type { MouseEvent } from 'react'
import { Node } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { videoEmbed, videoFileUrl } from '@/render/video'
import { useAdminT } from './I18nProvider'
import { SEGMENT_TRACK, tabItemClass } from './kit'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    video: { setVideo: (src: string) => ReturnType }
  }
}

function VideoView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const t = useAdminT()
  const raw = (node.attrs.src as string) || ''
  // A trailing `#wide` fragment sizes the player like a wide image; keep it out of URL
  // detection and re-attach it via the toggle, so the node still serializes to a bare URL.
  const [src, frag = ''] = raw.split('#')
  const wide = /wide/.test(frag)
  const v = videoEmbed(src)
  const file = v ? null : videoFileUrl(src)
  const setWide = (w: boolean) => updateAttributes({ src: w ? `${src}#wide` : src })
  // The iframe/native player swallows clicks, so clicking the video never selects the
  // node — and the size toolbar (shown when `selected`) could never appear. A transparent
  // overlay catches the click and selects the node instead (playback isn't needed here).
  const selectNode = (e: MouseEvent) => {
    e.preventDefault()
    const pos = getPos?.()
    if (pos != null) editor.commands.setNodeSelection(pos)
  }
  const overlay = <div className="absolute inset-0 cursor-pointer" onMouseDown={selectNode} />
  // `tabItemClass`, not a sixth hand-drawn pill. Four of these existed inside the editor
  // alone and none was caught, because `check:admin-kit` matched the tab track's exact string
  // and every copy had chosen `bg-neutral-100` over `bg-neutral-200/70`.
  const btn = (active: boolean) => tabItemClass(active, 'sm')
  return (
    <NodeViewWrapper as="div" className="my-4" data-drag-handle>
      {selected && (v || file) && (
        <div className="mb-2 flex flex-wrap gap-2" contentEditable={false} onMouseDown={(e) => e.preventDefault()}>
          <div className={SEGMENT_TRACK}>
            <button type="button" onClick={() => setWide(false)} className={btn(!wide)}>
              {t.imgSizeColumn}
            </button>
            <button type="button" onClick={() => setWide(true)} className={btn(wide)}>
              {t.imgSizeWide}
            </button>
          </div>
        </div>
      )}
      {v ? (
        <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: '16 / 9' }}>
          <iframe src={v.embed} className="absolute inset-0 h-full w-full" allowFullScreen loading="lazy" />
          {overlay}
        </div>
      ) : file ? (
        // Self-hosted video file (Library upload): native player, natural aspect —
        // mirrors the published .video-file rendering.
        <div className="relative">
          <video src={file} controls preload="metadata" playsInline className="block w-full rounded-lg" />
          {overlay}
        </div>
      ) : (
        <p className="break-all text-sm text-neutral-500">{src}</p>
      )}
    </NodeViewWrapper>
  )
}

export const Video = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return { src: { default: '' } }
  },
  parseHTML() {
    return [{ tag: 'div[data-video]', getAttrs: (el) => ({ src: (el as HTMLElement).getAttribute('data-src') || '' }) }]
  },
  renderHTML({ node }) {
    return ['div', { 'data-video': '', 'data-src': node.attrs.src }]
  },
  addNodeView() {
    return ReactNodeViewRenderer(VideoView)
  },
  addCommands() {
    return {
      setVideo:
        (src) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { src } }),
    }
  },
  addStorage() {
    return {
      markdown: {
        // Serialize back to a bare URL line.
        serialize(state: { write: (s: string) => void; closeBlock: (n: unknown) => void }, node: { attrs: { src: string } }) {
          state.write(node.attrs.src || '')
          state.closeBlock(node)
        },
        parse: {},
      },
    }
  },
})
