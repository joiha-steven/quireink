// THE CJK TAIL OF THE STACKS THAT ARE NOT A READING PRESET: the chrome (--font-sans), the code
// face (--font-mono) and a theme's own headline face (--font-display). Each ends on a variable,
// `var(--cjk-sans, sans-serif)` and its two siblings, and this fills it in for the page's
// language, and only on a page in Chinese, Japanese or Korean.
//
// ⚠️ NEVER ONE TAIL FOR ALL THREE LANGUAGES ON THESE STACKS. That was tried on 2026-11-04 and set
// a Japanese headline in Songti SC and PingFang SC, Chinese letterforms, where the machine's own
// fallback, which reads <html lang>, had picked Hiragino. With the variable unset the stack ends
// at its generic keyword exactly as before, so a page in any other language is unchanged.
//
// On :root, because that is where the stacks are declared and a var() in a custom property is
// resolved where it is declared: <html lang> is the piece's language on an article and the
// site's everywhere else (`web/layout.ts`). A sans or a monospace takes the sans tail (no reader
// has a CJK monospace; a CJK code font draws its Han in a gothic) and a serif the serif one, so
// Korean keeps its gothic in a serif role: a Mac's one myeongjo, AppleMyungjo, has no bold and
// Chrome set <strong> in it at text weight.
import { CJK_BY_LANG } from '@/content/fonts'

export function cjkRoleCss(lang: string): string {
  const key = lang.toLowerCase().split('-')[0] ?? ''
  const tail = CJK_BY_LANG[key]
  if (!tail) return ''
  return `:root:lang(${key}){--cjk-sans:${tail.sans}, sans-serif;--cjk-mono:${tail.sans}, monospace;`
    + `--cjk-serif:${tail.serif}, serif}`
}
