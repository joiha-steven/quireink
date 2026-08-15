// Guess the language of a fence that did not name one.
//
// WHY THIS EXISTS. A fence with no info string highlights as `text`, which has no tokens, so
// the block renders in one flat colour. That is correct and it is also how most people write:
// three backticks, paste, done. The owner's own blog is full of them, and the report was
// simply "so there is no colour?" — the colour was there all along and only for the posts
// that had remembered a word after the backticks.
//
// WHY IT IS DELIBERATELY TIMID. A wrong guess is worse than no guess: terminal OUTPUT in a
// fence is the commonest untagged block there is, and colouring stray words inside an error
// message makes the page look broken rather than rich. So every rule below needs a signal
// that prose and program output do not produce by accident — a shebang, a command name in
// the first position, an SQL verb, a tag, a brace with a quoted key. Anything under that bar
// stays `text`, which is exactly what it renders as today.
//
// It only ever runs for a fence that named NOTHING. A writer who tags a block is obeyed, even
// when the tag is wrong, because that is a choice and this is a fallback.

/** Only what `highlight.ts` has already loaded a grammar for. */
export type Detected = 'bash' | 'python' | 'sql' | 'json' | 'html' | 'yaml' | 'diff' | 'ts' | 'text'

/** The first lines carry the signal; a long paste does not make the guess better. */
const HEAD = 12

type Rule = { lang: Detected; test: (lines: string[], all: string) => boolean }

const SHELL_HEAD = /^\s*[$#]?\s*(sudo|apt|apt-get|yum|brew|curl|wget|git|cd|ls|mkdir|rm|cp|mv|chmod|chown|echo|printf|cat|grep|sed|awk|tar|ssh|scp|systemctl|docker|npm|npx|bun|pnpm|yarn|make|export|source|test)\s/

const RULES: Rule[] = [
  // A shebang is the one unambiguous marker in the whole list, so it is checked first and
  // decides on its own.
  { lang: 'bash', test: (l) => /^#!.*\b(sh|bash|zsh|dash)\b/.test(l[0] ?? '') },
  { lang: 'python', test: (l) => /^#!.*\bpython/.test(l[0] ?? '') },

  { lang: 'diff', test: (l, all) => /^diff --git |^@@ /m.test(all) || l.filter((x) => /^[+-][^+-]/.test(x)).length >= 2 },

  // Two command lines, not one: a single `make` could be prose about make.
  { lang: 'bash', test: (l) => l.filter((x) => SHELL_HEAD.test(x)).length >= 2 },
  { lang: 'bash', test: (l) => l.some((x) => /^\s*\$ \S/.test(x)) },

  // SHELL SYNTAX, not shell vocabulary, and it is the rule that made the difference on the
  // blocks this was written for. A script that runs `./thing.sh` and tests the result names
  // no command from the list above at the start of a line -- but `; then`, a closing `fi`, a
  // `[ -x` test and `&&` between two commands are shapes prose and program output do not
  // have. Two of them, so one stray `&&` in a sentence about shell cannot fire it.
  { lang: 'bash', test: (_l, all) => [
    /;\s*then\b/, /^\s*(fi|done|esac|else)\s*$/m, /\[\[? +-[a-z] /, /\$\(/,
    /^\s*\.\/\S+/m, /\bexit [0-9]/, /2>&1/, /&&\s*\S/, /\|\|\s*[{\S]/,
  ].filter((re) => re.test(all)).length >= 2 },

  { lang: 'sql', test: (l) => /^\s*(select|insert into|update|delete from|create (table|index|view)|alter table)\b/i.test(l[0] ?? '') },

  { lang: 'python', test: (l) => l.filter((x) => /^\s*(def |class |import |from \S+ import )/.test(x)).length >= 1 },

  // A quoted key is what separates JSON from an object literal in prose.
  { lang: 'json', test: (l, all) => /^\s*[{[]/.test(l[0] ?? '') && /"[^"]+"\s*:/.test(all) },

  { lang: 'html', test: (l) => /^\s*(<!doctype|<html|<div|<span|<p[ >]|<a |<script|<head|<body)/i.test(l[0] ?? '') },

  { lang: 'ts', test: (l) => l.filter((x) => /^\s*(import .+ from |export |const |let |function |class \w+ ?\{)/.test(x)).length >= 2 },

  // Last, and the loosest: `key: value` on most lines, with no braces to make it something
  // else. Two lines minimum, and a colon inside prose usually has no key before it.
  { lang: 'yaml', test: (l) => {
    const kv = l.filter((x) => /^\s*[\w.-]+:( |$)/.test(x)).length
    return kv >= 2 && kv >= l.filter((x) => x.trim()).length - 1 && !/[{}]/.test(l.join('\n'))
  } },
]

/**
 * The language, or `text` when nothing is sure enough.
 *
 * Pure and cheap: the caller keys its cache on the code, so this runs once per distinct block
 * per deploy and never on a cache hit.
 */
export function detectLang(code: string): Detected {
  const lines = code.split('\n').slice(0, HEAD)
  const head = lines.join('\n')
  if (!head.trim()) return 'text'
  for (const rule of RULES) if (rule.test(lines, head)) return rule.lang
  return 'text'
}
