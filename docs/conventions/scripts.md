# Scripts — `scripts/`

`bun scripts/<name>.ts` — idempotent. Every one of them is a `package.json` script too, and
that is the name to use: `bun run build:assets`, `bun run check:all`, `bun run user`,
`bun run shot`, `bun run drive`. Node is not in the toolchain
([ADR 0005](../decisions/0005-rewrite-in-bun-hono-sqlite.md)).

- **`install.sh` sits at the repository root, and is shell rather than `bun scripts/…`,**
  because it runs before there is a checkout to run anything from. It is the one-command
  form of the README's install path and does exactly what that path does — clone, install,
  build both artefacts, start the server — so a change to either means changing both. It
  never uses `sudo`, refuses to run as root, and is idempotent on the directory it is given.
- **The schema is not a script.** `src/store/schema.sql` and `src/store/schema-analytics.sql`
  are embedded and applied at boot; `src/store/migrations.sql` is one file, not a directory.
  Nothing has to be run by hand on a fresh install.
- **WordPress import is an in-app feature** (Admin → Settings → System →
  `src/import/wordpress.ts`), NOT a script. `turndown`, `turndown-plugin-gfm` and
  `fast-xml-parser` are runtime **dependencies** because the importer uses them.
- **`scripts/checks/`** holds the static guards `check:all` runs — `file-size`, `css-literal`,
  `no-nul`, `routes-guarded`, `type-roles`, `admin-kit`, `docs`. A new load-bearing rule that a
  test cannot hold belongs here, not in a comment.
- **A check that needs a RUNNING instance does not go in `scripts/checks/`.** Those are static
  and `check:all` runs them with nothing serving. `restore-check.ts` needs an instance, a
  session and its files on disk, so it hangs off `bun run tour`, which already has all three.
  It may write, and it takes back everything it wrote — a check that leaves rows behind
  changes what the next run is testing.
