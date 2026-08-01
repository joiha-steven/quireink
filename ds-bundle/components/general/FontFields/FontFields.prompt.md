FontFields from quireink. Use via `window.QuireInk.FontFields` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface FontFieldsProps {
value: string;
  onChange: (fontPreset: string, typography: TypographySettings) => void;
  chromeFont: string;
  onChromeFont: (v: string) => void;
}
```
