ToggleRow from quireink. Use via `window.QuireInk.ToggleRow` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

One row inside a bordered list: label, note, switch.

Built on `Setting` rather than laid out here, so the label size, the note style and the
gap between them are the ones every other setting uses. It was three hand-written
classes that had already drifted from the fields beside them.

## Props

```ts
interface ToggleRowProps {
checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc?: string;
  badge?: string;
}
```
