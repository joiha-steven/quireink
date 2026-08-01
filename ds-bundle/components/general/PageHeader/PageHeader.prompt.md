PageHeader from quireink. Use via `window.QuireInk.PageHeader` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface PageHeaderProps {
title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}
```
