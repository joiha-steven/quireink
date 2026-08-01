FeaturedField from quireink. Use via `window.QuireInk.FeaturedField` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface FeaturedFieldProps {
posts: { slug: string; title: string; }[];
  value: string[];
  onChange: (v: string[]) => void;
}
```
