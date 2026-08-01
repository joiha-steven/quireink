Tabs from quireink. Use via `window.QuireInk.Tabs` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface TabsProps {
tabs: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  variant?: "underline" | "segment";
  className?: string;
}
```
