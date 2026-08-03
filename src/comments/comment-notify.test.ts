// Who gets a reply email, and who does not.
//
// Every branch here is a decision NOT to send, and a wrong one is invisible from the outside:
// too loose and the site emails somebody who deleted their comment, or emails a person their
// own reply; too tight and the feature quietly stops working and nobody reports a missing
// email they did not know to expect.
//
// Nothing is mocked. `sendMail` never throws and records every attempt in `newsletter_sends`,
// so the presence of a row is the honest answer to "did it try to send". SMTP points at a
// closed port, so the attempt fails immediately and the row carries `ok = 0`.

import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { all, run } from '@/store/query'
import { saveSmtpConfig } from '@/news/mail'
import { savePost } from '@/content/posts'
import { notifyReply } from '@/comments/comment-notify'

const DIR = './.tmp/test-comment-notify'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const PARENT = 'reader@example.com'

/** The parent comment being replied to. */
function parentComment(email: string, deletedAt: number | null = null): number {
  run(
    `insert into comments (post_slug, author_name, author_email, content, created_at, deleted_at)
     values ('a-post', 'Reader', ?, 'Nice piece', 1700000000000, ?)`,
    email, deletedAt,
  )
  return all<{ id: number }>(`select id from comments order by id desc limit 1`)[0]!.id
}

const attempts = () =>
  all<{ email: string; kind: string }>(`select email, kind from newsletter_sends`)

const reply = (parentId: number, replierEmail = 'someone@example.com') =>
  notifyReply({
    parentId,
    postSlug: 'a-post',
    replierName: 'Someone',
    replierEmail,
    contentHtml: '<p>Agreed.</p>',
  })

beforeEach(async () => {
  run(`delete from comments`)
  run(`delete from newsletter_sends`)
  run(`delete from posts`)
  await savePost({
    title: 'A Post', slug: 'a-post', content: 'Body.', status: 'published',
    date: '2020-01-01T00:00:00.000Z',
  })
  // A closed port: configured enough to pass the gate, and the connection fails at once.
  await saveSmtpConfig({ host: '127.0.0.1', port: 1, from: 'blog@example.com' })
})

describe('notifyReply', () => {
  it('emails the parent commenter', async () => {
    await reply(parentComment(PARENT))
    expect(attempts()).toEqual([{ email: PARENT, kind: 'reply' }])
  })

  it('says nothing when the parent left no address', async () => {
    await reply(parentComment(''))
    expect(attempts()).toEqual([])
  })

  it('says nothing when the parent comment has been deleted', async () => {
    await reply(parentComment(PARENT, 1700000001000))
    expect(attempts()).toEqual([])
  })

  // Replying to yourself is the common case on a small blog, and an email about it is noise.
  it('does not email somebody their own reply', async () => {
    await reply(parentComment(PARENT), PARENT)
    expect(attempts()).toEqual([])
  })

  it('matches the replier against the parent ignoring case and spacing', async () => {
    await reply(parentComment(PARENT), `  ${PARENT.toUpperCase()} `)
    expect(attempts()).toEqual([])
  })

  it('says nothing when the parent does not exist at all', async () => {
    await reply(999_999)
    expect(attempts()).toEqual([])
  })

  it('sends nothing while SMTP is unconfigured, and records no attempt either', async () => {
    await saveSmtpConfig({ host: '', from: '' })
    await reply(parentComment(PARENT))
    expect(attempts()).toEqual([])
  })

  // Best-effort by contract: the comment POST route awaits this, so a throw here would fail
  // a comment that was already saved.
  it('never throws, whatever the mail server does', async () => {
    await expect(reply(parentComment(PARENT))).resolves.toBeUndefined()
  })
})
