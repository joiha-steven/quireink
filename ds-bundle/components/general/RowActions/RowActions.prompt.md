RowActions from quireink. Use via `window.QuireInk.RowActions` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface RowActionsProps {
editHref: string;
  viewHref?: string;
  onDelete: () => void;
}
```
