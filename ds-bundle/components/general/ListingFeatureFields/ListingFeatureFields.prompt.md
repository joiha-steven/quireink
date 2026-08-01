ListingFeatureFields from quireink. Use via `window.QuireInk.ListingFeatureFields` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

What a reader gets on the LISTING they arrive from.

## Props

```ts
interface ListingFeatureFieldsProps {
features: FeatureSettings;
  onChange: (f: FeatureSettings) => void;
}
```
