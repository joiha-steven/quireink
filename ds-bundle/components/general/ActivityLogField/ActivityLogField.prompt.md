ActivityLogField from quireink. Use via `window.QuireInk.ActivityLogField` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

The admin's own record of what changed. Not a reader feature at all.

## Props

```ts
interface ActivityLogFieldProps {
features: FeatureSettings;
  onChange: (f: FeatureSettings) => void;
}
```
