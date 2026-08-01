BarList from quireink. Use via `window.QuireInk.BarList` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface BarListProps {
title: ReactNode;
  rows: BarRow[];
  unit: ReactNode;
  empty: ReactNode;
}
```
