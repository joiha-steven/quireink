AnalyticsPageDetail from quireink. Use via `window.QuireInk.AnalyticsPageDetail` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface AnalyticsPageDetailProps {
data: PageSummary;
  title: string;
  range: 1 | 7 | 30 | 365;
}
```
