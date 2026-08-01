AdminI18nProvider from quireink. Use via `window.QuireInk.AdminI18nProvider` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface AdminI18nProviderProps {
lang: "vi" | "en" | "de" | "ja" | "zh" | "ko";
  children: ReactNode;
}
```
