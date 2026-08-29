// WHY THIS FILE EXISTS — `bun test` disagrees with the admin build about what JSX is.
//
// The repo holds two JSX dialects on purpose: the root tsconfig says `jsxImportSource:
// "hono/jsx"` (server markup), and `src/admin/tsconfig.json` says React. `Bun.build`
// (scripts/build-admin.ts) resolves the NEAREST tsconfig per file, so the shipped admin
// bundle is React. `bun test` does not: it transpiles every file with the ROOT tsconfig,
// so importing any `src/admin/*.tsx` under test yields hono/jsx nodes — objects React 19
// rejects with "Objects are not valid as a React child ({tag, props, key, children,
// isEscaped})". Measured 2026-08-29; the top-level `jsx*` keys bunfig.toml documents are
// ignored by `bun test` too, so a config line cannot fix it.
//
// This preload (bunfig `[test].preload`) closes the gap for the MOUNT tests
// (`src/admin/**/*.mount.test.tsx` and the components they render): every `.tsx` under
// `src/admin` is re-transpiled with the same React automatic runtime the real bundle
// uses. `.ts` files, the server tree and every non-admin test are untouched — the filter
// is the whole of the policy.

import { plugin } from 'bun'

plugin({
  name: 'admin-react-jsx',
  setup(build) {
    const transpiler = new Bun.Transpiler({
      loader: 'tsx',
      tsconfig: { compilerOptions: { jsx: 'react-jsx', jsxImportSource: 'react' } },
      // Without this the transform references the jsx factory but never emits its
      // import — a bare `jsxDEV_… is not defined` at the first element.
      autoImportJSX: true,
    })
    build.onLoad({ filter: /src[/\\]admin[/\\].*\.tsx$/ }, async (args) => {
      const source = await Bun.file(args.path).text()
      return { contents: transpiler.transformSync(source), loader: 'js' }
    })
  },
})
