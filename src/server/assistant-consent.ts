// WHICH ACTIONS THE OWNER HAS TO SAY YES TO.
//
// The assistant runs tools under the owner's session, and most of them are the sort of
// thing an owner would happily let it do unattended: read the drafts, write an excerpt,
// list the media. A few are not, and the difference is not "write" — creating a post is a
// write and nobody wants to approve one.
//
// The line drawn here is: an action the owner would want to have SEEN COMING. Something
// that removes work, replaces a whole surface, or leaves the building.
//
// A NAME, NOT A RULE. Deriving it (every `delete_*`, say) would be tidier and would let a
// future tool called `delete_draft_autosave` demand a click for a housekeeping job, or
// miss a destructive one that happens to be called `empty`. The list is short enough to
// read and `assistant-consent.test.ts` pins it, so widening it is a visible act.

const NEEDS_CONSENT = new Set([
  // Deletes. Soft, all of them — they go to the Trash — but "reversible" is a thing the
  // owner learns afterwards, and a model that has just binned nine posts on a
  // misunderstanding has still cost an afternoon.
  'delete_post',
  'delete_page',
  'delete_media',
  'delete_file',
  'delete_comment',

  // Replaces a whole surface with something new rather than adding to it.
  'compose_homepage',

  // Changes how the live site behaves for every reader, including two settings that can
  // take it off the air (`siteUrl`, `customCss`).
  'update_settings',
  'update_appearance',

  // Leaves the building: one sends mail, the others fetch from a host the owner did not
  // name in this conversation.
  'send_test_newsletter',
  'import_images',
  'add_media_from_url',
])

export const needsConsent = (tool: string): boolean => NEEDS_CONSENT.has(tool)

/**
 * The SECOND reason to stop, and it is about where the words came from rather than what
 * the tool does. A tool marked `untrusted` in its meta (`list_comments`) puts text written
 * by readers into the model's context, and from that moment an instruction in the
 * transcript may be a comment talking rather than the owner. So once such a result is in
 * the conversation, every tool that is not `readOnly` asks, for the rest of that
 * conversation. Reads stay free: a comment cannot do anything by being read twice. A tool
 * that does not exist is left to the runner, which answers it with an error.
 */
export type AskReason = 'listed' | 'untrusted'

export function askReason(
  tool: string,
  def: { meta: { readOnly?: true } } | undefined,
  afterUntrusted: boolean,
): AskReason | null {
  if (NEEDS_CONSENT.has(tool)) return 'listed'
  if (afterUntrusted && def && !def.meta.readOnly) return 'untrusted'
  return null
}

/** What the owner refused, in the shape a tool result takes. The model reads this and moves on. */
export const DECLINED = 'The owner declined this action. Do not try it again; ask what they would prefer.'
