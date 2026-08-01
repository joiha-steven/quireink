Combobox from quireink. Use via `window.QuireInk.Combobox` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface ComboboxProps {
label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  options: string[];
}
```
