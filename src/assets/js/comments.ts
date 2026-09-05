// Comments: fetch the tree, render it, post a new one.
//
// Fetched rather than server-rendered, which is the frozen tree's design and the right one
// here for a specific reason: the article page is CACHED HTML (Invariant 1), and a comment
// is not a post. Rendering comments into the page would mean either flushing the whole page
// cache every time a stranger types something, or serving a stale thread. Fetching keeps
// both problems away.
//
// Loaded only when the thread scrolls into view. A reader who never reaches the bottom of
// the article never pays for it.

import { el, label, payload } from './dom'
import { mountTurnstile } from './turnstile'
import { startSolving, takeSolution, solveFresh } from './stamp'

type Comment = {
  id: number
  parentId: number | null
  name: string
  website?: string
  contentHtml: string
  createdAt: string
  deleted: boolean
  replies: Comment[]
}

/**
 * One comment and its replies.
 *
 * `contentHtml` is assigned with innerHTML, and that is safe for exactly one reason: the
 * server rendered it through the limited-markdown sanitiser in `comment-md.ts`. The author
 * NAME is not, so it goes through textContent. Getting those two the wrong way round is
 * how a comment section becomes an XSS on every reader of the post.
 */
function render(comment: Comment): HTMLElement {
  const item = el('li', { class: 'comment', id: `comment-${comment.id}` })

  const who = el('span', { class: 'comment-name' })
  if (comment.website) {
    // `rel` on a stranger's link: no ranking transfer, no window.opener, no referrer.
    const link = el('a', { href: comment.website, rel: 'nofollow noopener ugc' })
    link.textContent = comment.name
    who.appendChild(link)
  } else {
    who.textContent = comment.name
  }

  // Date AND time. A thread is a conversation, and two replies on the same day said nothing
  // about their order while only the date was shown. The `datetime` attribute keeps the full
  // ISO instant either way; this is only what the reader sees, in their own zone.
  //
  // Formatted in two halves and joined, NOT by one `toLocaleString`. Several locales put the
  // clock first — Vietnamese renders "lúc 21:58 23 tháng 6, 2026" — and this thread wants
  // date then time, which is the order that reads as a log line inside the brackets the
  // IDE chrome puts around it.
  const at = new Date(comment.createdAt)
  const lang = document.documentElement.lang || 'en'
  const when = el('time', { datetime: comment.createdAt })
  when.textContent = `${at.toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric' })}`
    + ` ${at.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}`

  const body = el('div', { class: 'comment-body' })
  if (comment.deleted) body.textContent = label('commentDeleted')
  else body.innerHTML = comment.contentHtml

  const head = el('p', { class: 'comment-meta' }, who, ' · ', when)
  item.append(head, body)

  if (!comment.deleted) {
    const reply = el('button', { type: 'button', class: 'comment-reply' })
    reply.textContent = label('commentReply')
    reply.addEventListener('click', () => openForm(item, comment.id))
    item.appendChild(reply)
  }

  if (comment.replies.length) {
    const list = el('ul', { class: 'comment-replies' })
    for (const child of comment.replies) list.appendChild(render(child))
    item.appendChild(list)
  }
  return item
}

/** Who the server says this reader is. Read once per island load, alongside the thread. */
let signedInAs: string | null = null

/**
 * The identity strip above the form: a Google button, or who you are and a way to stop
 * being them.
 *
 * Absent entirely when the owner has not turned Google sign-in on, which is the common
 * case: a reader who will never use it should not have to look at it.
 */
function identityRow(root: HTMLElement, parentId: number | null): HTMLElement | null {
  if (!root.dataset.google) return null

  if (signedInAs === null) {
    const link = el('a', {
      class: 'comment-google',
      // A link, not a fetch: the reader is LEAVING for Google, and a navigation is what
      // that is. It also means the flow still works with the island's JS half-loaded.
      href: `/comment-auth/google?return=${encodeURIComponent(location.pathname)}`,
      rel: 'nofollow',
    })
    link.textContent = label('commentSignInGoogle')
    return el('p', { class: 'comment-identity' }, link)
  }

  const who = el('strong')
  who.textContent = signedInAs
  const out = el('button', { type: 'button', class: 'comment-signout' })
  out.textContent = label('commentSignOut')
  out.addEventListener('click', () => { void signOut() })
  return el('p',
    { class: 'comment-identity', id: `c-identity-${parentId ?? 'root'}` },
    `${label('commentAs')} `, who, ' · ', out)
}

async function signOut(): Promise<void> {
  await fetch('/comment-auth/signout', { method: 'POST' }).catch(() => {})
  signedInAs = null
  await load()
}

/** The form, built once per place it is opened. `parentId` null means a top-level comment. */
function buildForm(postSlug: string, parentId: number | null): HTMLFormElement {
  const field = (name: string, type: string, labelKey: string, required: boolean) => {
    const id = `c-${name}-${parentId ?? 'root'}`
    const input = el('input', {
      type, name, id, ...(required ? { required: 'required' } : {}),
    })
    const text = el('label', { for: id })
    text.textContent = label(labelKey)
    // The email note is a separate string in the locale table, so the label reads
    // "Email" and the hint sits beside it rather than inside the label text.
    if (name === 'email') text.append(` (${label('commentEmailNote')})`)
    return el('p', { class: 'comment-field' }, text, input)
  }

  // A visible label, not just an `aria-label`. The textarea was the one control on the form
  // with nothing above it, so it read as a stray box rather than as the field the whole form
  // exists for. The string is already in every locale, which is why this costs nothing.
  const areaId = `c-content-${parentId ?? 'root'}`
  const area = el('textarea', { name: 'content', id: areaId, rows: '5', required: 'required' })
  const areaLabel = el('label', { for: areaId })
  areaLabel.textContent = label('commentBody')
  const bodyField = el('p', { class: 'comment-field comment-body-field' }, areaLabel, area)

  const button = el('button', { type: 'submit' })
  button.textContent = label('commentSubmit')
  // The submit sits in a row of its own so the Turnstile widget can share it. Left on their
  // own they were two unrelated objects stacked with dead space between them.
  const actions = el('div', { class: 'comment-actions' }, button)

  const root = document.querySelector<HTMLElement>('#comments')
  const identity = root ? identityRow(root, parentId) : null
  // A signed-in reader is not asked for the three things Google already answered. The
  // server ignores them for that reader anyway, so leaving them on screen would be asking
  // for input that goes nowhere.
  // Grouped in one element so the three of them can share a grid: name and email are short
  // fields and were each stretching the full reading width, which is what made a three-field
  // form look like a page of empty boxes.
  const details = signedInAs === null
    ? [el('div', { class: 'comment-fields' },
        field('name', 'text', 'commentName', true),
        field('email', 'email', 'commentEmail', true),
        field('website', 'url', 'commentWebsite', false),
      )]
    : []

  const form = el('form', { class: 'comment-form' },
    ...(identity ? [identity] : []),
    ...details,
    bodyField,
    actions,
    el('p', { class: 'comment-status', role: 'status' }),
  ) as HTMLFormElement

  // The server refuses a comment whose Turnstile token does not verify whenever the owner
  // has it on, so the widget has to be here or the form cannot be completed at all. The
  // site key is server-rendered onto the mount point; absent means Turnstile is off.
  // A signed-in reader skips it, exactly as the server does.
  const siteKey = root?.dataset.turnstile
  if (siteKey && signedInAs === null) mountTurnstile(form, siteKey)
  // No widget, no account, no request: the stamp (ADR 0032) is solved in the background
  // from the moment a form exists, so it is ready long before anybody presses send.
  else if (signedInAs === null) startSolving(root)

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    void submit(form, postSlug, parentId, button)
  })
  return form
}

/** Open a reply form under a comment, or close it if it is already there. */
function openForm(item: HTMLElement, parentId: number): void {
  const existing = item.querySelector(':scope > .comment-form')
  if (existing) {
    existing.remove()
    return
  }
  const root = document.querySelector<HTMLElement>('#comments')
  if (!root?.dataset.post) return
  item.appendChild(buildForm(root.dataset.post, parentId))
}

async function submit(
  form: HTMLFormElement, postSlug: string, parentId: number | null, button: HTMLButtonElement,
): Promise<void> {
  const status = form.querySelector<HTMLElement>('.comment-status')
  if (!status) return
  const data = Object.fromEntries(new FormData(form).entries())

  button.disabled = true
  status.textContent = ''
  try {
    const send = (stamp: unknown): Promise<Response> => fetch('/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...data, postSlug, parentId, stamp }),
    })
    let res = await send(await takeSolution())
    // One retry, and only for a stale challenge: a page can sit in a cache or in a tab for
    // longer than a stamp lives, and losing what somebody wrote to that is unforgivable.
    if (res.status === 409) {
      status.textContent = label('commentChecking')
      res = await send(await solveFresh())
    }
    if (!res.ok) {
      // The server's message, not a generic one: it says which field is wrong, and the
      // reader has to fix it themselves.
      const { error } = await res.json().catch(() => ({})) as { error?: string }
      status.textContent = error ?? label('commentError')
      return
    }
    form.reset()
    // No "posted!" line: the thread is re-read and the comment appears in it, which says
    // the same thing without a message the reader then has to dismiss.
    await load()
  } catch {
    status.textContent = label('commentError')
  } finally {
    button.disabled = false
  }
}

/**
 * Who the server says the reader is.
 *
 * Its own request, and never a cached one: this is the only public response on the site
 * whose body differs per reader, so it cannot ride along in the thread (which a shared
 * cache is free to hold) without handing one reader another's name.
 */
async function loadIdentity(root: HTMLElement): Promise<void> {
  if (!root.dataset.google) return
  try {
    const res = await fetch('/api/comments/me')
    const { commenter } = await payload<{ commenter: { name: string } | null }>(res)
    signedInAs = commenter?.name ?? null
  } catch {
    // The manual form is the fallback and it works. A reader who was signed in sees the
    // fields again, which is wrong but usable; a hard failure here would be neither.
    signedInAs = null
  }
}

async function load(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#comments')
  const slug = root?.dataset.post
  if (!root || !slug) return

  let comments: Comment[] = []
  try {
    // Both at once. The identity request is small and uncached, and serialising it behind
    // the thread would delay the form for no reason.
    const [res] = await Promise.all([
      fetch(`/api/comments?post=${encodeURIComponent(slug)}`),
      loadIdentity(root),
    ])
    ;({ comments } = await payload<{ comments: Comment[] }>(res))
  } catch {
    root.textContent = label('commentError')
    return
  }

  root.replaceChildren()
  const heading = el('h2')
  heading.textContent = label('commentsHeading')
  root.appendChild(heading)

  if (comments.length) {
    const list = el('ul', { class: 'comment-list' })
    for (const comment of comments) list.appendChild(render(comment))
    root.appendChild(list)
  } else {
    const empty = el('p', { class: 'empty' })
    empty.textContent = label('commentsEmpty')
    root.appendChild(empty)
  }
  const form = buildForm(slug, null)
  root.appendChild(form)

  // A sign-in that did not complete comes back as a fragment, because a query string would
  // become a second cache entry for the same page and anyone could mint thousands of them.
  if (location.hash === '#comment-auth-error') {
    const status = form.querySelector<HTMLElement>('.comment-status')
    if (status) status.textContent = label('commentSignInError')
    // Cleared so a reload, or a reader who scrolls back later, does not see it again.
    history.replaceState(null, '', location.pathname + location.search)
  }
}

export function comments(): void {
  const root = document.querySelector<HTMLElement>('#comments')
  if (!root?.dataset.post) return

  // A reader coming back from a failed sign-in lands at the TOP of the post, which is
  // nowhere near the thread — so the observer below would never fire and the message would
  // never be read. Load immediately and take them to it instead.
  if (location.hash === '#comment-auth-error') {
    void load().then(() => root.scrollIntoView({ block: 'start' }))
    return
  }

  // Nothing is fetched until the thread is near the viewport. Most readers never reach it,
  // and a request they never see is a request not worth making.
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return
    observer.disconnect()
    void load()
  }, { rootMargin: '400px' })
  observer.observe(root)
}
