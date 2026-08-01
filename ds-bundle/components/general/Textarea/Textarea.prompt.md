Textarea from quireink. Use via `window.QuireInk.Textarea` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface TextareaProps {
label?: string;
  note?: ReactNode;
  /* plus the standard props inherited from react */
  [key: string]: unknown;
}
```
