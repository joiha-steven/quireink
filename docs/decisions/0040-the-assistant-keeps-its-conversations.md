# 0040. The assistant keeps its conversations

Date: 2026-08-31 · Status: accepted · Reverses a behaviour stated in
[`docs/features/admin.md`](../features/admin.md), not a prior ADR

## What was true until today

The in-admin assistant held its conversation in the open browser tab and nowhere else. The
history was posted back with each question and the server stored nothing. `AssistantView.tsx`
said it plainly, and so did the feature documentation: *close the tab and it is gone*. The
argument was that the blog's database holds posts, not chats.

## What changes

Conversations are stored, in the blog's own SQLite database, in a new `assistant_chats`
table. The assistant screen grows the shape the writing screen has: a list of conversations
on the left, the one you are reading on the right.

## Why the old argument does not survive the feature

The list is the feature. A conversation the owner cannot return to is one they must not
start anything long in, and everything the assistant is good at is long: a settings sweep, a
tidy-up of drafts, a series of questions about the same week's numbers. Tab-only history made
the screen safe to build and unsafe to rely on.

Browser storage was considered and rejected. It would have kept the letter of the old promise
while breaking its spirit anyway: the conversation would exist, just in a place the owner
cannot back up, cannot move to another machine, and cannot delete from the admin they trust
to delete things. A stored thing should be stored where everything else is stored.

## What this costs, stated plainly

- **Chats are now in the backup.** The archive that carries posts and uploads carries
  conversations too, which is right (they are the owner's) and worth saying out loud.
- **Chats contain whatever was typed.** The assistant is asked about the blog, but nothing
  stops an owner pasting something else into it. The table is owner-gated like every other
  admin route, and never reaches a reader-facing payload.
- **Deleting is deleting.** A conversation the owner removes is gone, not trashed. Posts go
  to the Trash because a post is work; a chat is a receipt of work, and a Trash full of them
  would bury the thing the Trash is for.

## What does not change

The model still receives a WINDOW of the conversation rather than all of it, capped where it
was. Storage is not memory: a long chat costs the same to answer whether it lives in a tab or
a table, and the screen now says what that costs so the owner can decide when to start again.
