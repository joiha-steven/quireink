TypographyFields from quireink. Use via `window.QuireInk.TypographyFields` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface TypographyFieldsProps {
typography: TypographySettings;
  /** The chosen reading font, so Reset restores ITS setup and not another font's. */
  fontPreset: string;
  onChange: (typography: TypographySettings) => void;
}
```
