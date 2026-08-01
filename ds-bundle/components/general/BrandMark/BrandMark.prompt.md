BrandMark from quireink. Use via `window.QuireInk.BrandMark` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

Height-driven, both of them: the letterforms have fixed proportions, so setting the height
and letting the width follow is the only sizing that cannot distort them.

## Props

```ts
interface BrandMarkProps {
height?: number;
}
```
