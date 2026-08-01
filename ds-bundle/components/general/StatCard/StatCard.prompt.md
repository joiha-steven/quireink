StatCard from quireink. Use via `window.QuireInk.StatCard` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface StatCardProps {
label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  href?: string;
}
```
