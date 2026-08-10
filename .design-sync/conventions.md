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
