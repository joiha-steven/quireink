PostSettings from quireink. Use via `window.QuireInk.PostSettings` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface PostSettingsProps {
draft: Draft;
  update: (partial: Partial<Draft>) => void;
  allCategories: string[];
  allTags: string[];
  allSeries: string[];
  onPickFeatured: () => void;
  onPickCover: () => void;
}
```
