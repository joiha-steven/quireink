MultiSelect from quireink. Use via `window.QuireInk.MultiSelect` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface MultiSelectProps {
label: string;
  value: string[];
  options: string[];
  placeholder?: string;
  onChange: (next: string[]) => void;
  lowercase?: boolean;
}
```
