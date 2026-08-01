Button from quireink. Use via `window.QuireInk.Button` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface ButtonProps {
variant?: "primary" | "secondary" | "ghost" | "danger";
  /* plus the standard props inherited from react */
  [key: string]: unknown;
}
```
