TrashView from quireink. Use via `window.QuireInk.TrashView` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface TrashViewProps {
posts: Post[];
  pages: Page[];
  media: MediaItem[];
  files: FileItem[];
  comments: AdminComment[];
}
```
