ThemeFields from quireink. Use via `window.QuireInk.ThemeFields` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface ThemeFieldsProps {
presets: ThemePreset[];
  themes: Record<string, ThemeSettings>;
  defaultId: string;
  enabled: string[];
  onChangeThemes: (themes: Record<string, ThemeSettings>) => void;
  onSetDefault: (id: string) => void;
  onChangeEnabled: (ids: string[]) => void;
}
```
