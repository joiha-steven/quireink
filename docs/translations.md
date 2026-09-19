> Read when adding a language, or correcting one.

# Translations — `locales/`

Eleven languages ship, on the reader's side and in the admin: English, Tiếng Việt, Deutsch,
日本語, 简体中文, 한국어, Français, Español, Português (Brasil), Italiano and Русский. The first
question setup asks is which one this blog speaks.

## Adding one

Every language is a pair of files of quoted strings under [`locales/`](../locales):

| File | Who reads it |
|---|---|
| `locales/<code>.ts` | the reader, on the published site |
| `locales/admin/<code>.ts` | the owner, in the admin |

To add a language: copy the two `en` files, translate them, and register the code in
`locales/langs.ts`, `src/types.ts` and `DATE_LOCALE` in `src/i18n/format.ts`.

**The compiler refuses to build until every key exists**, so a half-done translation cannot ship
silently. `AdminStrings` is declared in `locales/types.ts` rather than inferred from `en`, which
is why a new key has to be named there first and then answered by all eleven files.

Pull requests welcome — a native speaker's ear beats ours.

## The typography guard

`bun run check:i18n` holds eight conventions across all 22 files. The one that catches people
first: **no straight apostrophe**. `'` is a typewriter mark; the letter is `’`, and French,
English and Italian elision all want it. The guard also knows that French puts a space before
`:` and `?`, that German and Russian have their own quotation marks, and that a locale should
not silently inherit another's punctuation.

Read the strings already in the file you are editing before writing a new one. Register,
formality and how much English is left untranslated are decisions each language made once, and a
string that disagrees with its neighbours reads as a different voice on the same screen.
