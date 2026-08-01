PostForm from quireink. Use via `window.QuireInk.PostForm` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface PostFormProps {
initial?: PostWithContent;
  allCategories: string[];
  allTags: string[];
  allSeries: string[];
  contentWidth: number;
  typewriterEffects: boolean;
}
```
