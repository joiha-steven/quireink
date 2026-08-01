FrontFields from quireink. Use via `window.QuireInk.FrontFields` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface FrontFieldsProps {
front: FrontSettings;
  onChange: (f: FrontSettings) => void;
  posts: { slug: string; title: string; }[];
  categories: string[];
}
```
