MediaLibrary from quireink. Use via `window.QuireInk.MediaLibrary` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface MediaLibraryProps {
mode?: "page" | "picker";
  multi?: boolean;
  onSelect?: ((url: string) => void);
  onSelectMany?: ((urls: string[]) => void);
  onClose?: (() => void);
}
```
