AdminSidebar from quireink. Use via `window.QuireInk.AdminSidebar` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface AdminSidebarProps {
lang: "vi" | "en" | "de" | "ja" | "zh" | "ko";
  signOut: () => Promise<void>;
}
```
