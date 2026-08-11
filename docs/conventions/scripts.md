# Scripts — `scripts/`

`bun scripts/<name>.ts` — idempotent. Every one of them is a `package.json` script too, and
that is the name to use: `bun run build:assets`, `bun run check:all`, `bun run user`,
`bun run shot`, `bun run drive`. Node is not in the toolchain
([ADR 0005](../decisions/0005-rewrite-in-bun-hono-sqlite.md)).

- **The schema is not a script.** `src/store/schema.sql` and `src/store/schema-analytics.sql`
  are embedded and applied at boot; `src/store/migrations.sql` is one file, not a directory.
  Nothing has to be run by hand on a fresh install.
- **WordPress import is an in-app feature** (Admin → Settings → Integrations →
  `src/import/wordpress.ts`), NOT a script. `turndown`, `turndown-plugin-gfm` and
  `fast-xml-parser` are runtime **dependencies** because the importer uses them.
- **`scripts/checks/`** holds the static guards `check:all` runs — `file-size`, `css-literal`,
  `no-nul`, `routes-guarded`, `type-roles`, `admin-kit`, `docs`. A new load-bearing rule that a
  test cannot hold belongs here, not in a comment.
