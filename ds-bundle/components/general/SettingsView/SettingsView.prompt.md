SettingsView from quireink. Use via `window.QuireInk.SettingsView` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface SettingsViewProps {
settings: SiteSettings;
  presets: ThemePreset[];
  commentEnv: CommentEnv;
  integrations: IntegrationStatus;
  posts: { slug: string; title: string; }[];
  pages: { slug: string; title: string; }[];
  categories: string[];
}
```
