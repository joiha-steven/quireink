ThemeToggle from quireink. Use via `window.QuireInk.ThemeToggle` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface ThemeToggleProps {
lang: "vi" | "en" | "de" | "ja" | "zh" | "ko";
  variant?: "icon" | "text";
  triggerClassName?: string;
}
```
