Setting from quireink. Use via `window.QuireInk.Setting` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

One setting whose control is not a plain text field: a picker grid, a switch, a button, a
row of them. Pass the control as children; the label and note are placed for you.

`inline` is for a boolean: a 24px switch beside its label reads better than one stranded
on its own line, and it keeps a list of fifteen feature toggles scannable. The ORDER is
unchanged — label, note, control — it is only the wrap that differs.

## Props

```ts
interface SettingProps {
label?: ReactNode;
  note?: ReactNode;
  badge?: string;
  inline?: boolean;
  children: ReactNode;
  className?: string;
}
```
