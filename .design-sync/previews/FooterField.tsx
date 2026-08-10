import { FooterField } from 'quireink'
import { SETTINGS } from './_fixtures'

// The default carries the `{year}` and `{title}` placeholders plus a markdown link.
export function Default() {
  return <FooterField value={SETTINGS.footer} onChange={() => {}} />
}

export function Custom() {
  return <FooterField value="© {year} {title} · [RSS](/rss.xml) · [Colophon](/page/colophon)" onChange={() => {}} />
}

export function Empty() {
  return <FooterField value="" onChange={() => {}} />
}
