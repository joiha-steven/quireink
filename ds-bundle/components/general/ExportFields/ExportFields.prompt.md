ExportFields from quireink. Use via `window.QuireInk.ExportFields` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface ExportFieldsProps {
backups: BackupSettings;
  onChange: (b: BackupSettings) => void;
}
```
