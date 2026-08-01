Editor from quireink. Use via `window.QuireInk.Editor` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface EditorProps {
initialContent: string;
  onChange: (markdown: string) => void;
  onDirty: () => void;
  onPickImage: () => void;
  onPickGallery: () => void;
  onUploadFile: (file: File) => Promise<string | null>;
  apiRef: MutableRefObject<EditorApi | null>;
  contentWidth: number;
  toolbarTop?: number;
  typewriterEffects: boolean;
}
```
