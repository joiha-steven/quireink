FileUploader from quireink. Use via `window.QuireInk.FileUploader` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface FileUploaderProps {
onUploaded: (items: FileItem[]) => void;
  accept?: string;
  label?: string;
}
```
