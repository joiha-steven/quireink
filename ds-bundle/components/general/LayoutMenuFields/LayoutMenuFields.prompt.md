LayoutMenuFields from quireink. Use via `window.QuireInk.LayoutMenuFields` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface LayoutMenuFieldsProps {
s: SiteSettings;
  update: (p: Partial<SiteSettings>) => void;
  posts: { slug: string; title: string; }[];
  pages: { slug: string; title: string; }[];
}
```
