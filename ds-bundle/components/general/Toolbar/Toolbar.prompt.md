Toolbar from quireink. Use via `window.QuireInk.Toolbar` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface ToolbarProps {
editor: TiptapEditor;
  onPickImage: () => void;
  onPickGallery: () => void;
  raw: boolean;
  onToggleRaw: () => void;
  stickyTop: number;
}
```
