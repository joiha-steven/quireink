FontUpload from quireink. Use via `window.QuireInk.FontUpload` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface FontUploadProps {
value: FontSettings;
  onChange: (font: FontSettings) => void;
}
```
