ToggleField from quireink. Use via `window.QuireInk.ToggleField` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface ToggleFieldProps {
checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}
```
