CheckField from quireink. Use via `window.QuireInk.CheckField` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

A checkbox, for the two places a boolean sits inside a tight grid where a 44px switch
would not fit: the palette cards' "show to readers", and the SMTP TLS row. Those were
raw `<input type="checkbox">` with browser-default chrome, which is why they looked like
a different application from the switches above them.

## Props

```ts
interface CheckFieldProps {
checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}
```
