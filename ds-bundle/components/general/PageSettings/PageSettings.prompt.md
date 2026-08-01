PageSettings from quireink. Use via `window.QuireInk.PageSettings` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface PageSettingsProps {
draft: PageDraft;
  update: (partial: Partial<PageDraft>) => void;
  onPickFeatured: () => void;
}
```
