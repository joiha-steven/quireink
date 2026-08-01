MediaToolbar from quireink. Use via `window.QuireInk.MediaToolbar` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface MediaToolbarProps {
count: number;
  totalSize: number;
  query: string;
  onQuery: (v: string) => void;
  sort: "new" | "name" | "size";
  onSort: (s: MediaSort) => void;
}
```
