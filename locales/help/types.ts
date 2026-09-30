// The Help screen's words, one file per language beside `locales/admin/` (2026-09-30).
//
// It was English only, by a note that called the prose a mirror of the repository docs — so an
// owner who runs the admin in Vietnamese opened Help and read a page in another language that
// also named five settings tabs the admin no longer has.
//
// WHAT A TRANSLATOR TOUCHES: the text. What they leave exactly as it is:
//
//   - the HTML tags and every attribute in them (`<p class="links">`, `<ul class="after">`);
//   - every `href`: `/admin/...` is a screen, `doc:docs/x.md` is a page of the repository docs;
//   - `{t:someKey}`, which the screen replaces with that key of the admin dictionary, so a tab or
//     a card is named exactly as the admin names it in that language;
//   - `{tabs}`, which becomes the list of the settings tabs;
//   - what is inside `<code>`, which is typed, not read;
//   - the section ids, the keys of `index`, `markdown` and `keys`.
//
// `help.test.ts` holds every language to the English one's shape.
export type HelpSection = { id: string; title: string; body: string }

export type HelpText = {
  intro: string
  /** The jump index: section id → its chip. */
  index: Record<string, string>
  sections: HelpSection[]
  markdownTitle: string
  markdownLede: string
  markdownHead: [string, string]
  /** Markdown the editor understands: the syntax (never translated) → what it does. */
  markdown: Record<string, string>
  keysTitle: string
  keysLede: string
  keysHead: [string, string]
  /** Shortcut id (`admin-shared/keys.ts`) → what the key does. */
  keys: Record<string, string>
  troubleTitle: string
  troubleLede: string
  troubleHead: [string, string]
  /** Symptom → what to do. */
  trouble: [string, string][]
}
