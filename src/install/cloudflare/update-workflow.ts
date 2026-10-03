// The Update Quire Ink workflow, as this release ships it: what Settings → Server → Cloudflare hands
// a button blog's owner to commit into their copy (`admin-shared/source-repo.ts` says why the copy has
// none of its own).
//
// ⚠️ A COPY OF `.github/workflows/update-quireink.yml`, AND IT HAS TO BE ONE. Importing that file
// straight from `.github/` was the first idea, and it breaks two builds out of three:
//
//   1. The button's copy is built on Cloudflare's machine from the copy itself, and the copy is
//      exactly the tree with no `.github/workflows` in it. The import would fail the first deploy of
//      every blog this exists to help.
//   2. The Docker image's build context leaves `.github` out (`.dockerignore`), so the image would
//      fail to build too.
//
// So the file lives here as well, and `settings-server-cloud.test.ts` holds it equal to the real one
// byte for byte on every `check:all`. Change `.github/workflows/update-quireink.yml`, then copy it over
// this one; the test prints the command.
import workflow from './update-quireink.yml' with { type: 'text' }

export const UPDATE_WORKFLOW: string = workflow
