Overview from quireink. Use via `window.QuireInk.Overview` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface OverviewProps {
posts: number;
  pages: number;
  comments: number;
  originals: number;
  variants: number;
  files: number;
  totalBytes: number;
  categories: Taxo[];
  tags: Taxo[];
  recent: ActivityEntry[];
  activityEnabled: boolean;
  version: string;
  commit: string | null;
  system: SystemInfo;
  dashboard: DashboardData;
  seo: SeoHealth;
  sources: TrafficSources;
}
```
