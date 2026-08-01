SeoFields from quireink. Use via `window.QuireInk.SeoFields` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface SeoFieldsProps {
s: SiteSettings;
  update: (p: Partial<SiteSettings>) => void;
}
```
