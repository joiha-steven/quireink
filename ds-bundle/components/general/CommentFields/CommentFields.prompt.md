CommentFields from quireink. Use via `window.QuireInk.CommentFields` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface CommentFieldsProps {
comments: CommentSettings;
  onChange: (c: CommentSettings) => void;
}
```
