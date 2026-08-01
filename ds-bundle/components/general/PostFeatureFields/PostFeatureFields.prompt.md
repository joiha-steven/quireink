PostFeatureFields from quireink. Use via `window.QuireInk.PostFeatureFields` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

What a reader gets on a POST.

## Props

```ts
interface PostFeatureFieldsProps {
features: FeatureSettings;
  onChange: (f: FeatureSettings) => void;
  relatedCount: number;
  onRelatedCount: (n: number) => void;
}
```
