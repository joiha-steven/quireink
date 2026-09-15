// What a GALLERY is, as far as the editor is concerned: a run of consecutive `#grid` pictures.
//
// Two things need to know where a run starts and stops, and neither of them is one picture's
// business — which is why this is a file of its own rather than a method on the node view. The
// column count is a property of the run (adding a fifth photo changes the width of the four
// already there), and so are the crop ratio and the caption switch (one square tile in a mosaic
// of tall ones is not something anybody sets on purpose).
import type { Node as PMNode } from 'prosemirror-model'
import type { EditorState } from 'prosemirror-state'
import { Plugin, PluginKey, type PluginSpec } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import type { EditorView } from 'prosemirror-view'
import { galleryCols } from '@/render/gallery-cols'

/** What this plugin's own spec says a decorations function is. Derived, so it cannot drift. */
type DecorationsProp = NonNullable<NonNullable<PluginSpec<void>['props']>['decorations']>
import { buildSrc, parseFrag, type GridOpts } from './image-frag'

/** Is this node a gallery tile? Asked of raw nodes during the document walks below. */
export function isTile(node: PMNode): boolean {
  const raw: unknown = node.attrs.src
  return node.type.name === 'image' && parseFrag(typeof raw === 'string' ? raw : '').grid
}

const GALLERY_COLS = new PluginKey('galleryCols')

/**
 * THE PUBLISHED COLUMN COUNT, STAMPED ON EVERY TILE, worked out once per document rather than
 * once per tile.
 *
 * The editor used to lay every gallery out three across whatever its size, while the page used
 * `galleryCols`: two, three or four by count. So the commonest gallery of all — four pictures —
 * was 3+1 while you wrote it and 2x2 once you published it, and nothing on the screen said
 * which was true.
 *
 * ⚠️ A DECORATION, NOT A FIGURE EACH NODE VIEW WORKS OUT FOR ITSELF, and that is correctness
 * before it is speed. The count is a property of the RUN: adding a fifth photo changes the
 * width of the four already there, and ProseMirror does not call `update()` on a node whose own
 * attributes did not change. The React version got away with it only because
 * `shouldRerenderOnTransaction` redrew every node view on every keystroke — which also means it
 * walked the whole document once per tile per keystroke, twenty times over for a gallery of
 * twenty. This walks it once.
 */
export function galleryColsPlugin(): Plugin {
  return new Plugin({
    key: GALLERY_COLS,
    props: {
      // ONE CAST, and it is a packaging fact rather than a type this file gets wrong: two
      // copies of `prosemirror-view` are installed, 1.42.3 at the root (which is where
      // `Decoration` here comes from) and 1.42.2 nested under `prosemirror-state`, and
      // `DecorationSet` carries a private field, so TypeScript reads them as different
      // classes. `FindExtension.ts` carries the same one, with the same derived target — when
      // the duplicate is deduped both casts become no-ops rather than lies.
      decorations: ((state: EditorState): DecorationSet | null => {
        const found: Decoration[] = []
        let run: { pos: number; end: number }[] = []
        const close = (): void => {
          if (run.length) {
            // A run of one keeps `galleryCols`' own answer (1), for which the sheet has no rule
            // — so a lone `#grid` picture falls through to the default tile width, as before.
            // The renderer does not group a run of one into a gallery either.
            const cols = String(galleryCols(run.length))
            for (const t of run) found.push(Decoration.node(t.pos, t.end, { 'data-cols': cols }))
          }
          run = []
        }
        state.doc.forEach((child, offset) => {
          if (isTile(child)) run.push({ pos: offset, end: offset + child.nodeSize })
          else close()
        })
        close()
        return found.length ? DecorationSet.create(state.doc, found) : null
      }) as unknown as DecorationsProp,
    },
  })
}

/**
 * Apply an option to EVERY tile in this gallery, in one transaction.
 *
 * The ratio and the caption switch belong to the run: one square tile in a mosaic of tall ones
 * is not something anybody sets on purpose, and a twenty-photo gallery is twenty trips through
 * this toolbar if a button only touches what is selected.
 *
 * The new value is decided once, by the caller, from the tile the author clicked. Deriving it
 * per tile instead would make a run that had somehow gone inconsistent stay that way, with each
 * half flipping past the other on every click.
 */
export function applyToGallery(view: EditorView, pos: number, opts: Partial<GridOpts>): void {
  const tiles: { offset: number; src: string; grid: boolean }[] = []
  view.state.doc.forEach((child, offset) => {
    const raw: unknown = child.attrs.src
    tiles.push({ offset, src: typeof raw === 'string' ? raw : '', grid: isTile(child) })
  })

  const here = tiles.findIndex((t) => t.offset === pos)
  if (here < 0) return
  let from = here
  let to = here
  while (from > 0 && tiles[from - 1]?.grid) from -= 1
  while (to < tiles.length - 1 && tiles[to + 1]?.grid) to += 1

  // Attribute-only changes, so no position shifts: the offsets stay valid across the loop.
  const tr = view.state.tr
  for (let i = from; i <= to; i += 1) {
    const tile = tiles[i]
    if (!tile) continue
    const f = parseFrag(tile.src)
    tr.setNodeAttribute(tile.offset, 'src', buildSrc(f.clean, { ...f, ...opts }))
  }
  view.dispatch(tr)
}
