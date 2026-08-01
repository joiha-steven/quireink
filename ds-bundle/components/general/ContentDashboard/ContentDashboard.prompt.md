ContentDashboard from quireink. Use via `window.QuireInk.ContentDashboard` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface ContentDashboardProps {
posts: Post[];
  pages: Page[];
  views: Record<string, number>;
  commentCounts: Record<string, number>;
  commentsEnabled: boolean;
}
```
