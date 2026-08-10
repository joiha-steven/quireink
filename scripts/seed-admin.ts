// Everything in the fixture that exists for the ADMIN rather than for the reader.
//
// The demo injects a session, so a visitor can open every owner-facing screen — and until
// this file existed most of them were empty states. Trash: nothing in it. Media: a drop zone.
// Subscribers: "No subscribers yet". Redirects: an empty table. Revisions: the panel does not
// render at all without a second save. Scheduled publishing, which is a headline feature,
// had no post waiting anywhere.
//
// An empty screen is not a screenshot of a feature, it is a screenshot of its absence, and
// the demo is the only place most people will ever see these. So each block below fills one
// screen through the SAME function the admin calls, never by writing a row: a fixture built
// on hand-made rows stops matching the product the first time a write path changes shape.
//
// The two exceptions are timestamps. `created_at` on a subscriber and `sent_at` on a
// newsletter row are stamped from the clock by design, and a mailing list where all forty
// addresses arrived in the same second is the detail that gives a fixture away. Those are
// written afterwards, and only those.
//
// The Log screen is the one owner-facing surface NOT filled from here: it is a hand-written
// timeline rather than a by-product of writing rows, so it lives in `seed-activity.ts`.

import { savePost, deletePost } from '@/content/posts'
import { savePage, deletePage } from '@/content/pages'
import { addSubscriber, confirmSubscriber, unsubscribeByToken } from '@/news/subscribers'
import { logSend, newOpenToken } from '@/news/newsletter-log'
import { saveRedirect } from '@/server/redirects'
import { run } from '@/store/query'

const DAY = 24 * 60 * 60 * 1000

/**
 * Posts in progress, which is what an editor's list looks like on any blog that is alive.
 *
 * Deliberately unfinished — a note to self at the bottom, a section that stops mid-argument.
 * A "draft" that reads as a finished post makes the status badge meaningless.
 */
const DRAFTS = [
  {
    title: 'Ligatures, and the three you can safely turn off',
    slug: 'ligatures-and-the-three-you-can-turn-off',
    category: 'Typography', tags: ['opentype', 'craft'],
    content: `The **fi** ligature exists because the f's hook collides with the i's dot in most serif faces. That is a drawing problem, and it was solved by drawing a third letter.

Which of them are load-bearing and which are decoration is the interesting question, and the answer changes by typeface.

## The standard set

\`fi\`, \`fl\`, \`ff\`, \`ffi\`, \`ffl\`. On a face with a short f these are unnecessary and switching them off changes nothing visible.

## Discretionary is a different argument

TODO — the **st** and **ct** ligatures, and why a body text setting is the wrong place for them. Need to check what Literata actually ships before claiming anything here.

## Where they break

Search. A word containing a ligature may not match the same word typed with two letters, depending on how the PDF was produced —`,
  },
  {
    title: 'Notes towards a printing glossary',
    slug: 'notes-towards-a-printing-glossary',
    category: 'Printing', tags: ['vocabulary', 'reference'],
    content: `Started because I keep having to look the same twelve words up.

**Bleed** — artwork extended past the trim so a cutting error shows ink rather than paper. 3 mm is standard, 5 mm on anything bound.

**Creep** — see the imposition post; the outer pages of a gathering lose more margin at trim than the inner ones.

**Gutter** — the inner margin. Also, confusingly, the space between columns on the same page.

**Kiss cut** — a die cut through the face material and not the backing.

**Perfecting** — printing both sides of the sheet in one pass.

**Set-off** — wet ink transferring onto the back of the sheet stacked on top of it.

TODO: overprint, trapping, rich black — but those got their own post, so link rather than repeat. Also need: signature, quire, gathering (post exists), and the whole paper-weight mess (post exists).

Decide whether this is a page or a post before publishing. Probably a page.`,
  },
  {
    title: 'Why this blog has no comments on some posts',
    slug: 'why-some-posts-have-no-comments',
    category: 'Typography', tags: ['meta'],
    content: `Draft, and possibly a bad idea to publish at all.

The honest reason is that a post about kerning does not need a discussion attached to it, and an empty comment box under an article reads as failure rather than as a choice.

Not sure this is worth saying out loud.`,
  },
]

/**
 * Posts waiting for their date, which is the only way to see that feature at all.
 *
 * These are dated from the REAL clock rather than from the fixture's origin, and they have to
 * be: "scheduled" is not a status in this product (`src/server/scheduled.ts`) — it is a
 * published post whose date has not arrived, so a post scheduled relative to a fixed origin
 * in the past is simply a published post. It is the one thing here that cannot be
 * deterministic, and the alternative is a feature the demo never shows.
 */
const SCHEDULED = [
  {
    title: 'Hanging punctuation, and the margin nobody notices',
    slug: 'hanging-punctuation-and-the-margin',
    category: 'Typography', tags: ['detail', 'craft', 'margins'],
    inDays: 3,
    excerpt: 'A quotation mark at the start of a line makes the margin look dented. The fix is four hundred years old.',
    content: `Set a paragraph that begins with a quotation mark and look at the left edge from a distance. The first line is indented by the width of the mark, and because a quote is mostly white space the eye reads the whole line as starting late.

Hanging punctuation pushes the mark out into the margin so the LETTERS line up rather than the characters. Gutenberg's compositors did it by hand, and it is the single cheapest improvement available to a page of quoted text.

## The CSS is one property and it is not everywhere

\`hanging-punctuation: first last\` does the whole job in Safari and nothing at all in Chrome or Firefox at the time of writing, which is why almost no page on the web has it.

The fallback is a negative text-indent on the offending element, applied by hand. It is not worth doing for body text and it is very much worth doing for a pull quote, because a pull quote is large enough that the dent is obvious.

## The other half of the rule

The same applies to the right edge in justified text, and to hyphens at a line break. Both hang. Both are off by default. Both are invisible until someone shows you, and permanently visible afterwards.`,
  },
  {
    title: 'A bibliography for people who set type',
    slug: 'a-bibliography-for-people-who-set-type',
    category: 'Typography', tags: ['reference', 'books'],
    inDays: 11,
    excerpt: 'Six books, and the order to read them in. Two are about printing rather than type, and they are the two that change how you work.',
    content: `Six books, and an argument about the order.

## Start with the one about the tool

*Writing and Illuminating and Lettering*, Edward Johnston, 1906. Everything since is a footnote to it, and it is the only one on the list that will have you holding a pen by the end of chapter two.

## Then the one about the page

*The Elements of Typographic Style*, Robert Bringhurst. Read the chapter on the measure, then stop and set something, then read the rest.

## Then the two about printing

*An Introduction to Bookbinding*, and any decent trade guide to imposition. Neither is about type at all, and between them they explain more about why books look the way they do than the type books manage.

## And two to argue with

*The Crystal Goblet*, Beatrice Warde — the case for invisible typography, made better than anyone has made it since, and wrong in interesting ways.

*Detail in Typography*, Jost Hochuli. Short, and about the things this blog is mostly about: the space between letters and the space between lines.`,
  },
]

/**
 * Fill every owner-facing screen that renders an empty state without one.
 *
 * `origin` is the fixture's timeline anchor (the newest published post) and `now` is the real
 * clock. They are separate arguments because the two are used for different things and
 * conflating them is what put comments before the posts they hung off in an earlier draft.
 */
export async function seedAdmin(origin: number, now: number): Promise<{
  drafts: number; scheduled: number; subscribers: number; redirects: number
}> {
  for (const [i, d] of DRAFTS.entries()) {
    await savePost({
      title: d.title, slug: d.slug, status: 'draft',
      // Dated when it was last touched, which is what the editor's list sorts on.
      date: new Date(origin - i * 6 * DAY).toISOString(),
      content: d.content, categories: [d.category], tags: d.tags,
    })
  }

  for (const s of SCHEDULED) {
    await savePost({
      title: s.title, slug: s.slug, status: 'published',
      date: new Date(now + s.inDays * DAY).toISOString(),
      content: s.content, excerpt: s.excerpt, categories: [s.category], tags: s.tags,
    })
  }

  await seedRevisions(origin)
  await seedTrash(origin)
  await seedPages()
  const subscribers = await seedSubscribers(origin, now)
  const redirects = await seedRedirects()

  return { drafts: DRAFTS.length, scheduled: SCHEDULED.length, subscribers, redirects }
}

/**
 * A post with a history, so the revisions panel has something to open.
 *
 * `savePost` snapshots the previous version whenever the projection changes
 * (`src/content/revisions.ts`), so three saves leave two revisions — and the product keeps at
 * most three, which is why this stops at three rather than looping.
 */
async function seedRevisions(origin: number): Promise<void> {
  const slug = 'five-inks-and-when-to-reach-for-each'
  const passes = [
    // The first draft of the section, before the rule at the end existed.
    'A pen box has five colours in it and a student uses all five, but not at random.\n\nDRAFT — needs the section on why one colour per meaning matters.',
    // A middle pass: the argument is there, the closing paragraph is not.
    'A pen box has five colours in it and a student uses all five, but not at random. Over a term a private grammar develops.\n\n## The rule that makes it work\n\nOne colour per meaning, across the whole site, forever.',
  ]
  const { getPost } = await import('@/content/posts')
  const live = await getPost(slug)
  if (!live) return

  // Walk the drafts, then restore the published body. The revisions left behind are the two
  // earlier passes plus the published one, and the product keeps the newest three.
  //
  // The second argument is the slug being EDITED. Without it `ensureSlugFree` sees the post's
  // own row and refuses the save as a collision — an overwrite has to say what it is
  // overwriting, and a fresh insert is the only call that may leave it out.
  for (const [i, content] of passes.entries()) {
    await savePost({ ...live, content, date: new Date(origin - (3 - i) * DAY).toISOString() }, slug)
  }
  await savePost({ ...live }, slug)
}

/** One post and one page in the trash, so both tabs of the Trash screen have a row. */
async function seedTrash(origin: number): Promise<void> {
  await savePost({
    title: 'Three weeks with a reed pen', slug: 'three-weeks-with-a-reed-pen',
    status: 'draft', date: new Date(origin - 40 * DAY).toISOString(),
    categories: ['Calligraphy'], tags: ['practice'],
    content: 'Abandoned. The pen was fine and the writing was not, and there was no post in it.\n\nKeeping the note in case the reed comes back out.',
  })
  await deletePost('three-weeks-with-a-reed-pen')

  await savePage({
    title: 'Links', slug: 'links', status: 'draft',
    content: 'Replaced by the bibliography post. Kept until that one is published.',
  })
  await deletePage('links')
}

/** The pages a real blog has beside its posts. Colophon is seeded by the caller. */
async function seedPages(): Promise<void> {
  await savePage({
    title: 'About', slug: 'about', status: 'published',
    content: `This is a blog about letterforms and the making of pages: calligraphy, type, layout and printing.

It is written by one person, published from one server, and set in the typefaces it argues for.

## Why these subjects

Because they are the same subject. A serif is a record of a pen; a margin is a record of a fold; a type scale is a record of somebody deciding what a page is for. Follow any of them far enough and you arrive at the other two.

## What runs it

[Quire Ink](https://github.com/joiha-steven/quireink), which is one process and two SQLite files. There is no database server, no build step and no deploy: the words go in through the admin and out as finished HTML.

The reading page is the product here, so every size, colour and space on it is a setting rather than a line of code.`,
  })

  await savePage({
    title: 'Archive', slug: 'archive', status: 'published',
    content: `Everything published here, by subject.

## Typography

The measure, the type scale, optical size, the golden canon. What a subsetter removes, and why the em dash is not the en dash.

## Calligraphy

The broad-edged pen, chancery italic, uncials, and how a page is ruled before anything is written on it.

## Printing

Imposition, registration, trapping, paper weights, and the vocabulary the bindery still uses.

Two series run across those: **Designing a reading page** in four parts, and **Ink and press** in three.`,
  })
}

/**
 * A mailing list in all three states, with a broadcast already sent to it.
 *
 * Three states because the subscriber table has a status column and a filter above it, and
 * both are furniture until something differs. The send log matters for the same reason: the
 * per-address "last sent / opened" column is computed from it, and with no rows every address
 * reads "never".
 */
async function seedSubscribers(origin: number, now: number): Promise<number> {
  const CONFIRMED = [
    'marta.vogel', 'ellen.prydz', 'petra.nowak', 'rahel.bekele', 'marcus.adeyemi',
    'helene.roussel', 'ines.vogel', 'marie.dubois', 'yusuf.demir', 'aoife.byrne',
    'jonas.lindqvist', 'tomas.ferreira', 'sam.okonkwo', 'owen.tremaine', 'brid.nimhaolain',
    'daniel.kovacs', 'lan.nguyen', 'quocanh.tran', 'ada.oyelaran', 'karel.novotny',
  ]
  const PENDING = ['nils.eriksen', 'chiara.rossi', 'foteini.lambrou']
  const UNSUBSCRIBED = ['printdeals.offers', 'lucas.moreau']

  let seq = 0
  const stamp = (email: string, status: 'pending' | 'confirmed' | 'unsubscribed'): void => {
    // Spread arrivals back across roughly eight months, oldest first, so the list has a shape
    // and the "joined" column is not one date repeated forty times.
    const created = origin - (240 - seq * 11) * DAY
    seq += 1
    run(
      `update subscribers set created_at = ?, confirmed_at = ? where email = ?`,
      created, status === 'confirmed' ? created + 2 * 60 * 60 * 1000 : null, email,
    )
  }

  const broadcastSlugs = ['the-golden-canon-and-its-arithmetic']
  for (const name of CONFIRMED) {
    const email = `${name}@example.com`
    const { token } = await addSubscriber(email)
    await confirmSubscriber(token)
    stamp(email, 'confirmed')
  }
  for (const name of PENDING) {
    const email = `${name}@example.com`
    await addSubscriber(email)
    stamp(email, 'pending')
  }
  for (const name of UNSUBSCRIBED) {
    const email = `${name}@example.com`
    const { token } = await addSubscriber(email)
    await confirmSubscriber(token)
    await unsubscribeByToken(token)
    stamp(email, 'unsubscribed')
  }

  // The issue that went out with the newest post. Two failures in it on purpose: the send log
  // exists to show which addresses bounced, and a log where every row succeeded cannot.
  for (const [i, name] of CONFIRMED.entries()) {
    const email = `${name}@example.com`
    const ok = i !== 6 && i !== 17
    await logSend({
      email, kind: 'broadcast', ok, postSlugs: broadcastSlugs,
      openToken: newOpenToken(),
      ...(ok ? {} : { error: i === 6 ? 'mailbox full' : 'domain not found' }),
    })
    // One row per address in this fixture, so no need to single out the newest.
    const sentAt = now - 2 * DAY + i * 4000
    run(`update newsletter_sends set sent_at = ? where email = ?`, sentAt, email)
    // Roughly half opened, which is a believable rate and enough rows for the column to vary.
    if (ok && i % 2 === 0) {
      run(`update newsletter_sends set opened_at = ? where email = ?`, sentAt + (3 + i) * 3600_000, email)
    }
  }

  return CONFIRMED.length + PENDING.length + UNSUBSCRIBED.length
}

/**
 * Slugs that changed, and the old URLs still working.
 *
 * The product writes one of these by itself whenever a published post is renamed, so the
 * table is normally a record of the site's own history. Seeded here because the fixture is
 * built in one pass and never renames anything.
 */
async function seedRedirects(): Promise<number> {
  const REDIRECTS = [
    // What each post was called before it was rewritten, which is the ordinary case.
    { source: '/the-measure', destination: '/the-measure-is-the-design', permanent: true },
    { source: '/type-scale', destination: '/a-type-scale-you-can-defend', permanent: true },
    { source: '/quire', destination: '/a-signature-a-gathering-a-quire', permanent: true },
    // A section that was folded into a page rather than a post.
    { source: '/colophon.html', destination: '/colophon', permanent: true },
    // Temporary, and off-site: the one case where `permanent: false` is the right answer.
    { source: '/source', destination: 'https://github.com/joiha-steven/quireink', permanent: false },
  ]
  for (const r of REDIRECTS) await saveRedirect(r)
  return REDIRECTS.length
}
