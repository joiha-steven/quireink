Link from quireink. Use via `window.QuireInk.Link` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<RouterProvider>` (full provider chain in README.md — components read theme/i18n from that context).

An anchor that routes in place. A real `href` throughout, so middle-click, Ctrl-click
and "open in new tab" all keep working — which is why the modifier check below is not
optional. An external or non-admin href falls through to the browser.

## Props

```ts
interface LinkProps {
/** Accepted and ignored: Next prefetches, this bundle is already loaded. */
  prefetch?: boolean;
  scroll?: boolean;
  replace?: boolean;
  /* plus the standard props inherited from react */
  [key: string]: unknown;
}
```
