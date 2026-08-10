// The comment threads the fixture ships with.
//
// It had two comments, both on one post, and every screen that counts comments therefore
// showed a 1. The admin's comment list is a table with one row in it; the moderation queue,
// the per-post counts on the content dashboard and the "3 replies" line under an article all
// render their empty state. None of that is a picture of the feature.
//
// THREE TIERS IS THE PRODUCT'S LIMIT (`MAX_DEPTH = 2` in `src/comments/comments.ts`), so the
// deepest thread here is exactly three deep. A fixture that never reaches the limit cannot
// show what the indent does at it, and one that tries to exceed it throws.
//
// BOLD AND ITALIC ONLY. `src/comments/comment-md.ts` is a deliberately tiny subset — no
// links, no code, no headings — so a thread written with backticks in it would render the
// backticks. Written to that subset rather than discovered against it.
//
// TIMESTAMPS ARE WRITTEN AFTERWARDS. `addComment` stamps `created_at` with the clock, which
// would put a nine-message thread in the same second and make every relative time read "just
// now". The update below is the only place this seeder touches a table directly, and it is
// worth the exception: a thread whose replies do not follow its parent in time is the one
// detail that gives a fixture away.

import { addComment, softDeleteComment } from '@/comments/comments'
import { run } from '@/store/query'

/** One comment. The two things that differ between a root and a reply are its timing. */
type Node = {
  name: string
  country: string
  body: string
  website?: string
  replies?: Reply[]
}

/** Hours after its parent. A reply lands the same day; a follow-up takes a week. */
type Reply = Node & { after: number }

/** Days after the post was published. Nobody comments on the minute it goes up. */
type Thread = Node & { post: string; at: number }

const AUTHOR = 'The author'

/**
 * The threads, newest post first.
 *
 * The author answers in four of them and not in the rest, because a blog where every comment
 * gets a reply reads as a demo and a blog where none does reads as abandoned.
 */
const THREADS: Thread[] = [
  {
    post: 'the-golden-canon-and-its-arithmetic', at: 2,
    name: 'Ellen Prydz', country: 'NO', website: 'https://example.org/ellen',
    body: 'The bottom-margin point is the one I keep having to re-argue with clients. They see white space at the foot of the page and read it as a mistake. Showing them the same spread with even margins usually settles it in about four seconds.',
    replies: [
      {
        name: AUTHOR, country: 'VN', after: 20,
        body: 'That is the demonstration, yes. Nobody can be *told* that a block sinks — they have to see the two versions side by side, and then it is obvious and stays obvious.',
        replies: [
          {
            name: 'Ellen Prydz', country: 'NO', after: 5,
            body: 'Stealing "it stays obvious". That is exactly the property that makes it worth teaching rather than just fixing.',
          },
        ],
      },
      {
        name: 'Tomás Ferreira', country: 'PT', after: 51,
        body: 'Worth adding that the canon assumes the page ratio is fixed. On a 2:3 page it is lovely. On something squarer the text block gets uncomfortably wide before the margins look right.',
      },
    ],
  },
  {
    post: 'optical-size-is-not-a-scale', at: 3,
    name: 'Rahel Bekele', country: 'DE',
    body: 'The honesty about pinning the axis is refreshing. Most posts about variable fonts stop at "and it is wonderful" without ever weighing the bytes against what the reader actually gets.',
    replies: [
      {
        name: AUTHOR, country: 'VN', after: 14,
        body: 'It cost half the preloaded font payload, so it was not a close call. If the same site were setting 60pt display type on every page I would have decided the other way.',
      },
    ],
  },
  {
    post: 'what-a-subsetter-removes', at: 1,
    name: 'Petra Nowak', country: 'PL',
    body: 'The unicode-range point deserves to be louder. I spent a year assuming a declared family was a downloaded family, and sized my font budget accordingly. It was wrong by about 70%.',
    replies: [
      {
        name: 'Marcus Adeyemi', country: 'GB', after: 9,
        body: 'Same, and the reason it survives is that devtools shows you the *declarations* in one panel and the *transfers* in another, and nobody cross-references the two.',
        replies: [
          {
            name: 'Petra Nowak', country: 'PL', after: 3,
            body: 'Which is the argument for measuring a real page rather than reading a directory listing, which is exactly what the post says. Fair enough.',
          },
        ],
      },
      {
        name: 'Jonas Lindqvist', country: 'SE', after: 74,
        body: 'Does re-subsetting from upstream every time not risk the foundry shipping a revised drawing under you? I would want the source file checked in.',
      },
      {
        name: AUTHOR, country: 'VN', after: 96,
        body: 'It does, and that is the right instinct — the upstream version is pinned rather than tracked. A revised drawing arriving silently would show up as a golden-render diff, which is a rude way to find out.',
      },
    ],
  },
  {
    post: 'the-em-the-en-and-three-dashes', at: 4,
    name: 'Hélène Roussel', country: 'FR',
    body: 'The minus sign is my hill. A financial table set with hyphens looks *wrong* and almost nobody can say why, which makes it very hard to get budget to fix.',
    replies: [
      {
        name: 'Sam Okonkwo', country: 'NG', after: 30,
        body: 'Tabular figures first, minus sign second. If the columns do not line up nobody gets as far as noticing the dash.',
      },
    ],
  },
  {
    post: 'five-inks-and-when-to-reach-for-each', at: 6,
    name: 'Ines Vogel', country: 'AT',
    body: 'The line about a colour stopping being a signal once it is the most common thing on the page applies to about half the design systems I have worked in, not just to highlighters.',
    replies: [
      {
        name: AUTHOR, country: 'VN', after: 26,
        body: 'It is the same failure as a codebase where everything is a warning. The signal is the *scarcity*, not the colour.',
      },
      {
        name: 'Daniel Kovács', country: 'HU', after: 44,
        body: 'Curious whether the chisel ends survive at small sizes. On a phone at 15px I would expect the stroke ends to just read as noise.',
      },
    ],
  },
  {
    post: 'paper-weights-and-the-table-nobody-agrees-on', at: 5,
    name: 'Marie Dubois', country: 'CA',
    body: 'Grain direction. Every single time. I have watched a beautiful 400-page job come back with every page curling like a crisp because nobody said the word out loud.',
    replies: [
      {
        name: 'Owen Tremaine', country: 'IE', after: 17,
        body: 'And it is not on any spec sheet, so it only exists if someone asks. Put it on the purchase order.',
        replies: [
          {
            name: 'Marie Dubois', country: 'CA', after: 28,
            body: 'On the purchase order *and* on the dummy request. Twice, in writing, is about right for something that cannot be fixed afterwards.',
          },
        ],
      },
    ],
  },
  {
    post: 'trapping-and-the-black-that-is-not-black', at: 8,
    name: 'Yusuf Demir', country: 'TR',
    body: 'Registration black as a colour is the one I still see in supplied files most weeks. It looks like the blackest black in the picker, so of course people pick it.',
    replies: [
      {
        name: AUTHOR, country: 'VN', after: 22,
        body: 'The name is the trap. It sounds like a *quality* of black rather than a press mark, and nothing in the interface says otherwise until the ink coverage warning fires — if the tool has one at all.',
      },
    ],
  },
  {
    post: 'dau-phu-tieng-viet', at: 3,
    name: 'Nguyễn Thị Lan', country: 'VN',
    body: 'Chỗ chữ hoa có dấu đúng là chỗ hay bị bỏ qua nhất. Tiêu đề viết hoa toàn phần trông ổn trên máy thiết kế, đến lúc lên web thì dấu của **Ữ** với **Ộ** dính vào dòng trên.',
    replies: [
      {
        name: 'Trần Quốc Anh', country: 'VN', after: 12,
        body: 'Mình bỏ hẳn tiêu đề viết hoa toàn phần cho tiếng Việt. Nới line-height tới mức đủ chỗ cho dấu thì cả khối chữ lại rời rạc, không đáng.',
        replies: [
          {
            name: AUTHOR, country: 'VN', after: 36,
            body: 'Đó cũng là lý do trang này không có chỗ nào viết hoa toàn phần. Bỏ đi thì đơn giản hơn nhiều so với việc chỉnh cho nó chịu được cả sáu thứ tiếng.',
          },
        ],
      },
    ],
  },
  {
    post: 'uncials-and-the-slow-hand', at: 11,
    name: 'Bríd Ní Mhaoláin', country: 'IE',
    body: 'The Jerome footnote is my favourite piece of trivia in the whole field. An entire script named after somebody being rude about it.',
  },
  {
    post: 'the-measure-is-the-design', at: 2,
    name: 'Marta Vogel', country: 'DE',
    body: 'The leading point is the one nobody plans for. I set a beautiful 66-character measure and then wondered for a week why German copy still felt cramped. It was the umlauts, every time.',
    replies: [
      {
        name: AUTHOR, country: 'VN', after: 19,
        body: 'Vietnamese is the same lesson at twice the volume: two marks stacked on one vowel, so the ascender space a Latin face reserves is simply not enough.',
        replies: [
          {
            name: 'Marta Vogel', country: 'DE', after: 41,
            body: 'Two marks on one vowel would have saved me the week. I only had one and it was still enough to break the line.',
          },
        ],
      },
      {
        name: 'Aoife Byrne', country: 'IE', after: 63,
        body: 'The two-columns-of-45 point at the end is the one people resist hardest, and it is the one that is easiest to prove with a stopwatch.',
      },
    ],
  },
]

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/**
 * Insert one comment and stamp it, then recurse into its replies.
 *
 * Returns nothing: the ids are only needed as parents, and holding them anywhere else would
 * invite a second pass over a structure that is already a tree.
 */
async function place(node: Node, post: string, parentId: number | null, at: number): Promise<void> {
  const inserted = await addComment({
    postSlug: post, parentId,
    name: node.name,
    // A demo address, and never the author's real one. `@example.com` is reserved by RFC
    // 2606 precisely so a fixture cannot mail a stranger by accident.
    email: `${node.name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
    website: node.website ?? '', provider: 'manual',
    content: node.body, ip: '', country: node.country,
  })
  run(`update comments set created_at = ? where id = ?`, at, inserted.id)
  for (const reply of node.replies ?? []) {
    await place(reply, post, inserted.id, at + reply.after * HOUR)
  }
}

/**
 * Seed every thread against a timeline whose origin is the post it hangs off.
 *
 * `postDate` resolves a slug to the millisecond the post was published, so a comment can
 * never predate the thing it is commenting on — which it did, in the first draft of this
 * file, for every post older than the fixed origin.
 */
export async function seedComments(postDate: (slug: string) => number): Promise<number> {
  let count = 0
  for (const thread of THREADS) {
    const start = postDate(thread.post) + thread.at * DAY
    await place(thread, thread.post, null, start)
    count += 1 + countReplies(thread)
  }

  // One comment in the trash, so the Trash screen has a Comments tab worth opening and the
  // "restore" path has something to restore. Spam rather than an argument: a deleted comment
  // that reads as a disagreement makes the moderation look like censorship, which is not the
  // thing being demonstrated.
  const spam = await addComment({
    postSlug: 'paper-weights-and-the-table-nobody-agrees-on', parentId: null,
    name: 'PrintDeals', email: 'offers@example.com', website: 'https://example.com/offers',
    provider: 'manual', ip: '', country: 'US',
    content: 'CHEAPEST PAPER STOCK ONLINE — bulk discounts on every gsm, message us for a quote today!',
  })
  run(`update comments set created_at = ? where id = ?`,
    postDate('paper-weights-and-the-table-nobody-agrees-on') + 9 * DAY, spam.id)
  await softDeleteComment(spam.id)

  return count
}

const countReplies = (node: Node): number =>
  (node.replies ?? []).reduce((n, r) => n + 1 + countReplies(r), 0)
