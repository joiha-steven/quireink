AnalyticsView from quireink. Use via `window.QuireInk.AnalyticsView` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface AnalyticsViewProps {
data: AnalyticsSummary;
  range: 1 | 7 | 30 | 365;
  titles: Record<string, string>;
}
```
