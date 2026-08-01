Input from quireink. Use via `window.QuireInk.Input` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface InputProps {
label?: string;
  note?: ReactNode;
  /* plus the standard props inherited from react */
  [key: string]: unknown;
}
```
