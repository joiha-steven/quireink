IconUpload from quireink. Use via `window.QuireInk.IconUpload` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface IconUploadProps {
kind: "favicon" | "app-icon";
  value: string;
  onChange: (url: string) => void;
  previewClassName: string;
}
```
