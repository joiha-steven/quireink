AdvancedFields from quireink. Use via `window.QuireInk.AdvancedFields` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface AdvancedFieldsProps {
typography: TypographySettings;
  onTypography: (t: TypographySettings) => void;
  ideChrome: boolean;
  onIdeChrome: (v: boolean) => void;
  motion: MotionSettings;
  onMotion: (m: MotionSettings) => void;
}
```
