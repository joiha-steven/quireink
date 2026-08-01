TrendChart from quireink. Use via `window.QuireInk.TrendChart` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface TrendChartProps {
points: DailyPoint[];
  peakLabel: string;
  viewsLabel: string;
  visitorsLabel: string;
}
```
