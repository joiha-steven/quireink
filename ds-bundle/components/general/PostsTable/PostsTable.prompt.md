PostsTable from quireink. Use via `window.QuireInk.PostsTable` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface PostsTableProps {
initialPosts: Post[];
  views: Record<string, number>;
  commentCounts: Record<string, number>;
  commentsEnabled: boolean;
}
```
