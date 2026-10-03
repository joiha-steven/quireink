// THE COPY A BUTTON BLOG IS BUILT FROM, and the two links Settings → Server → Cloudflare makes to it.
//
// A blog made with the Deploy to Cloudflare button updates through the repository the button made in
// the owner's GitHub: Actions → Update Quire Ink. But the button's import leaves `.github/workflows`
// out (measured 2026-10-04 on a real copy: one commit, "source repo import", no workflows directory),
// so that workflow is in no copy until the owner adds it. The card hands it over as a link to
// GitHub's new-file page with the file already filled in, and the owner presses Commit.
//
// It sits in `src/admin-shared/` because three places read it and must agree to the character: the
// server draws the links when the setting is already known (`web/admin/screens/settings-server-cloud.ts`),
// the island redraws them as the owner types (`admin/island/lib/settings-cloud.ts`), and the settings
// save keeps only a name this accepts (`content/settings-save.ts`). A name the island accepts and
// the save throws away is a link that works once and is gone on the next visit.
//
// GITHUB ONLY, and on purpose. The button also copies into GitLab, where none of this applies: GitLab
// does not run GitHub workflows, and its new-file page takes no file content in the address. The card
// says so in a sentence and points at the by-hand path in the docs rather than pretending.

/** Where the workflow lives in a copy, and the only path the link ever names. */
export const WORKFLOW_PATH = '.github/workflows/update-quireink.yml'

/**
 * `owner/repo` as GitHub allows it, and nothing looser: the name goes into a URL the owner is sent
 * to, so whatever passes here is a path on github.com and never a way out of one.
 *
 * The owner: 1 to 39 letters, digits or single hyphens, not starting or ending with one (GitHub's
 * own rule for user and organisation names). The repository: 1 to 100 of letters, digits, `.`, `_`
 * and `-`, and not `.` or `..`, which GitHub refuses because they are path segments.
 */
export const REPO_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}\/(?!\.\.?$)[A-Za-z0-9._-]{1,100}$/

/**
 * The name the owner meant, or null.
 *
 * ⚠️ A PASTED ADDRESS IS THE NAME, not a mistake. The way an owner gets this right is by copying it
 * out of the browser, which gives `https://github.com/jane/blog`, and the clone box gives
 * `https://github.com/jane/blog.git` or `git@github.com:jane/blog.git`. Refusing those would prove
 * only that the owner pasted it (the same reasoning as the address typed to confirm a delete,
 * `web/admin/cloudflare-update.ts`). Whatever is left after taking them off must still pass the
 * strict pattern above, so a GitLab address or a deeper path is refused, not guessed at.
 */
export function readRepo(typed: string): string | null {
  const name = typed.trim()
    .replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, '')
    .replace(/^git@github\.com:/i, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '')
  return REPO_PATTERN.test(name) ? name : null
}

/**
 * GitHub's new-file page in the copy, with the workflow filled in: the owner reads it there and
 * presses Commit changes. The branch is `main` because that is the branch the button deploys from.
 *
 * ⚠️ `encodeURIComponent`, NOT `URLSearchParams`. The second spells a space `+`, which a query parser
 * reads back as a space only by convention; `%20` means a space to every parser there is, and a YAML
 * file whose indentation arrived as plus signs is a workflow GitHub refuses to load.
 *
 * LENGTH, measured 2026-10-04 on the 2.2.17 workflow plus this fix's header: the file is 3,857 bytes
 * and the link 6,707 characters with a 39-character owner and a 100-character repository, the longest
 * names GitHub allows (6,576 for `jane/blog`). Under 8 KB, the safe ceiling for one request line:
 * servers commonly cap a request line there (nginx's default buffer is 8 KB), and browsers allow far
 * more. A test in `settings-server-cloud.test.ts` holds it under 8,000, so a workflow that grows past
 * it goes red here rather than as a 414 on the owner's screen.
 *
 * The path goes in as it is: letters, dots, hyphens and slashes, all legal in a query.
 */
export function newWorkflowUrl(repo: string, workflow: string): string {
  return `https://github.com/${repo}/new/main?filename=${WORKFLOW_PATH}&value=${encodeURIComponent(workflow)}`
}

/** The copy's Actions page, where Update Quire Ink is run from once the workflow is there. */
export const actionsUrl = (repo: string): string => `https://github.com/${repo}/actions`
