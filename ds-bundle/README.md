# Quire Ink admin UI — how to build with it

This is the design system of Quire Ink's **admin**: the single-owner tool behind a blog, not
the public reading site. It is deliberately monochrome. Colour carries no meaning here except
destructive intent, and hierarchy comes from weight, size and one hairline border.

## The one rule that will break your output if you miss it

**The stylesheet is Tailwind v4 compiled with `@source "src/admin"` — it contains only the
624 classes the admin itself already uses.** A class that no admin component uses is simply
not in `_ds_bundle.css`, and markup written with it renders unstyled. There is no JIT at
render time to save you.

Verified absent, as examples of the trap: `bg-blue-500`, `text-emerald-600`, `p-96`,
`grid-cols-12`, `sm:grid-cols-4`. Verified present: `md:grid-cols-4`, `lg:grid-cols-4`.

So: **before styling anything, read `_ds/<folder>/_ds_bundle.css`** and use what is there.
When in doubt, copy the class string off a component in `components/<group>/<Name>/` rather
than composing a new one.

## The vocabulary that is actually shipped

| Family | What exists |
|---|---|
| &nbsp;Colour | `neutral` 50–950 only, plus `white`, `black`, and `red` 50–950 reserved for destructive/error. There is no brand hue. |
| &nbsp;Surfaces | `bg-white`, `bg-neutral-50`, `bg-neutral-100`; dark side via `dark:bg-neutral-800`, `dark:bg-neutral-900` |
| &nbsp;Text | `text-neutral-500` (meta), `text-neutral-600`, `text-neutral-800`, `text-neutral-900`, `text-neutral-950` (headings), `text-white` |
| &nbsp;Borders | `border-neutral-200`, `border-neutral-300`; dark side `dark:border-neutral-700`, `dark:border-neutral-800`; `divide-y` for lists |
| &nbsp;Radius | `rounded-md`, `rounded-lg` (controls), `rounded-xl` (nested boxes), `rounded-2xl` (cards), `rounded-full` |
| &nbsp;Type | `text-xs`, `text-sm` (the admin's body size), `text-base`; `font-medium`, `font-semibold`; `tabular-nums` for any figure |
| &nbsp;Grid | `grid-cols-1/2/3` only at base; 4-up needs `md:grid-cols-4` or `lg:grid-cols-4` |
| &nbsp;Spacing | `space-y-5` between settings, `gap-2/3/4`, `p-4`, `p-5`, `sm:p-6` on cards |

**Dark mode is a class, not a media query.** The stylesheet declares
`@custom-variant dark (&:where(.dark, .dark *))`, so every `dark:` utility only applies under
a `.dark` ancestor on `<html>`. Never write `@media (prefers-color-scheme: dark)`.

## Wrapping and setup

Components read four contexts. Anything you build must sit inside all of them or it renders
empty or throws:

```jsx
<RouterProvider>                     {/* Link, usePathname, the top progress bar */}
  <AdminI18nProvider lang="en">      {/* useAdminT — most feature components call it */}
    <ToastProvider>                  {/* useToast — every save confirmation */}
      <ThemeProvider>                {/* light / dark / system / by-time */}
        <YourScreen />
      </ThemeProvider>
    </ToastProvider>
  </AdminI18nProvider>
</RouterProvider>
```

`AdminI18nProvider` throws without a `lang`; the accepted values are
`'en' | 'vi' | 'de' | 'ja' | 'zh' | 'ko'`. The fonts ship Vietnamese subsets, so Vietnamese
copy sets correctly — use it rather than transliterating.

## Composition idioms

- **A screen is `PageHeader` then cards.** `PageHeader` takes `title`, optional `description`
  and an `actions` slot that wraps rather than overflowing.
- **A setting reads label, then note, then control — never a hint under the control it
  explains.** `Setting` enforces that order; pass the control as children, and use
  `inline` for a boolean so the switch sits beside its label.
- **Never make a table the direct child of its frame.** `TableFrame` supplies the rounded
  surface and an inner scroll box; you supply `thead`/`tbody`.
- **Figures use `tabular-nums`**, always, so columns of numbers do not shimmy.

## An idiomatic screen

```jsx
<>
  <PageHeader
    title="Analytics"
    description="Page views and referrers for the last 30 days."
    actions={<Button variant="secondary">Export CSV</Button>}
  />
  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
    <StatCard label="Views" value="4,218" sub="12% up on last month" />
    <StatCard label="Visitors" value="1,902" />
  </div>
  <Card title="Referrers" className="mt-6">
    <TableFrame>
      <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500">
        <tr><th className="px-4 py-3 font-medium">Source</th><th className="px-4 py-3 text-right font-medium">Views</th></tr>
      </thead>
      <tbody>
        <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
          <td className="px-4 py-3">news.ycombinator.com</td>
          <td className="px-4 py-3 text-right tabular-nums text-neutral-500">1,663</td>
        </tr>
      </tbody>
    </TableFrame>
  </Card>
</>
```

`Button` has exactly four variants: `primary` (solid — the action you came to do),
`secondary` (faint border — everything else), `ghost` (borderless), and `danger` — which is
**outlined, not red-filled**, so a destructive action is prominent without being the loudest
thing on the screen.

## Where the truth lives

- `_ds/<folder>/styles.css` and its imports — `fonts/fonts.css` (Inter, Literata, Source
  Sans 3, Source Serif 4, JetBrains Mono, IBM Plex Mono, each with a Vietnamese subset) and
  `_ds_bundle.css` (the compiled utilities plus the runtime tokens).
- `components/<group>/<Name>/<Name>.d.ts` — the props contract.
- `components/<group>/<Name>/<Name>.prompt.md` — usage and examples.
- `guidelines/docs/admin-design.md` — the admin's own design rationale, written by its author.

# QuireInk (quireink@2.0.0)

This design system is the published quireink React library, bundled as a single
browser global. All 117 components are the real upstream code.

## Where things are

- `_ds_bundle.js` — the whole-DS bundle at the project root; loads every component to `window.QuireInk`. First line is a `/* @ds-bundle: … */` metadata header.
- `styles.css` — the single stylesheet entry: it `@import`s the tokens, fonts, and component styles (`_ds_bundle.css`). Link this one file.
- `components/<group>/<Name>/<Name>.prompt.md` (example JSX + variants), `<Name>.d.ts` (types), `<Name>.html` (variant grid).
- `tokens/*.css` — CSS custom properties, names verbatim from upstream.
- `fonts/` — `@font-face` files + `fonts.css` (when the package ships fonts).
- `guidelines/` — the design system's own usage guidance (12 doc(s), see `guidelines/index.md`). Read these before composing larger layouts.

For a specific component, `read_file("components/<group>/<Name>/<Name>.prompt.md")`.

## Loading

Add these two lines to your page once (React must be on the page first):

```html
<link rel="stylesheet" href="styles.css">
<script src="_ds_bundle.js"></script>
```

Components are then available at `window.QuireInk.*`. Mount into a dedicated child node (e.g. `<div id="ds-root">`), not the host page's own React root, so the two trees don't collide:

```jsx
const { ActivityLog } = window.QuireInk;
ReactDOM.createRoot(document.getElementById('ds-root')).render(<ActivityLog />);
```

Wrap the tree in the provider — most components read theme/i18n from context:

```jsx
<RouterProvider><AdminI18nProvider lang={"en"}><ToastProvider><ThemeProvider>{children}</ThemeProvider></ToastProvider></AdminI18nProvider></RouterProvider>
```

## Tokens

163 CSS custom properties from quireink. Names are
preserved verbatim from upstream. They are declared inside `_ds_bundle.css` (this DS ships one compiled stylesheet rather than separate token files).

- **color** (42): `--tw-border-spacing-x`, `--tw-border-spacing-y`, `--tw-border-style`, …
- **spacing** (5): `--tw-space-y-reverse`, `--tw-inset-shadow`, `--tw-inset-shadow-alpha`, …
- **typography** (12): `--tw-font-weight`, `--tw-tracking`, `--font-sans`, …
- **radius** (5): `--radius-sm`, `--radius-md`, `--radius-lg`, …
- **shadow** (7): `--tw-shadow`, `--tw-shadow-alpha`, `--tw-ring-shadow`, …
- **other** (92): `--tw-translate-x`, `--tw-translate-y`, `--tw-translate-z`, …

## Components

### general
- `ActivityLog`
- `ActivityLogField`
- `AdminI18nProvider`
- `AdminSidebar`
- `AdvancedFields`
- `AnalyticsPageDetail`
- `AnalyticsSection`
- `AnalyticsView`
- `BarList`
- `BrandFields`
- `BrandMark`
- `BrandWord`
- `BubbleBar`
- `Button`
- `CacheButton`
- `CacheFields`
- `CacheSection`
- `Card`
- `CheckField`
- `CloudflareFields`
- `Combobox`
- `CommentFields`
- `CommentIntegrations`
- `CommentsTable`
- `ContentDashboard`
- `DashboardWidgets`
- `Editor`
- `EmptyState`
- `ExportFields`
- `ExternalIcon`
- `FeaturedField`
- `FileLibrary`
- `FileUploader`
- `FontFields`
- `FontUpload`
- `FooterField`
- `FrontFields`
- `GalleryFields`
- `HelpGuide`
- `IconAnalytics`
- `IconCache`
- `IconChevronLeft`
- `IconComment`
- `IconContent`
- `IconExternal`
- `IconHelp`
- `IconHome`
- `IconLog`
- `IconMedia`
- `IconNewsletter`
- `IconSettings`
- `IconSignOut`
- `IconTrash`
- `IconUpload`
- `ImageUploader`
- `ImportFields`
- `Input`
- `LayoutMenuFields`
- `LibraryTabs`
- `Link`
- `ListingFeatureFields`
- `MarkdownTable`
- `McpFields`
- `McpSection`
- `MediaLibrary`
- `MediaSection`
- `MediaToolbar`
- `MultiSelect`
- `NewsletterFields`
- `NewsletterSend`
- `NewsletterSubscribers`
- `NewsletterTest`
- `NewsletterView`
- `Overview`
- `PageForm`
- `PageHeader`
- `PageSettings`
- `PagesTable`
- `PencilIcon`
- `PostFeatureFields`
- `PostForm`
- `PostSettings`
- `PostsTable`
- `ReadersSection`
- `RouterProvider`
- `RowActions`
- `Select`
- `SeoFields`
- `ServerSection`
- `Setting`
- `SettingsSection`
- `SettingsView`
- `SiteFields`
- `StatCard`
- `StatTile`
- `StatusPill`
- `Switch`
- `TableFrame`
- `Tabs`
- `Textarea`
- `ThemeFields`
- `ThemeProvider`
- `ThemeToggle`
- `TimeMachine`
- `ToastProvider`
- `ToggleField`
- `ToggleRow`
- `Toolbar`
- `TopProgress`
- `TrashIcon`
- `TrashView`
- `Trend`
- `TrendChart`
- `TroubleTable`
- `TypographyFields`
- `VideoLibrary`
- `WritingSection`
