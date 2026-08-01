PagesTable from quireink. Use via `window.QuireInk.PagesTable` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface PagesTableProps {
initialPages: Page[];
  views: Record<string, number>;
}
```
