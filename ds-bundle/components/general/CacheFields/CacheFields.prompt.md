CacheFields from quireink. Use via `window.QuireInk.CacheFields` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface CacheFieldsProps {
cache: CacheSettings;
  onChange: (c: CacheSettings) => void;
}
```
