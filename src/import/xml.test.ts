// The XML reader, at the shape `wordpress.ts` depends on and at the edges WXR actually has.
//
// The migration gate was a different thing and is worth recording: the same export was parsed by
// this and by `fast-xml-parser`, and every field the importer reads was compared. They agreed on
// all of them except one, which is the difference this file pins below — that library turns
// `007` into the number 7.
import { describe, expect, it } from 'bun:test'
import { parseXml, type XmlNode } from './xml'

const doc = (xml: string): XmlNode => parseXml(xml)

describe('the shape the importer reads', () => {
  it('makes a leaf its text and a parent an object', () => {
    expect(doc('<a><b>one</b></a>')).toEqual({ a: { b: 'one' } })
  })

  it('gives an element with attributes both halves', () => {
    expect(doc('<c domain="post_tag">Titanium</c>')).toEqual({
      c: { '#text': 'Titanium', '@_domain': 'post_tag' },
    })
  })

  it('makes a repeated name an array and a single one not', () => {
    const once = doc('<r><i>a</i></r>').r as XmlNode
    const twice = doc('<r><i>a</i><i>b</i></r>').r as XmlNode
    expect(once.i).toBe('a')
    expect(twice.i).toEqual(['a', 'b'])
  })

  it('keeps a namespaced name exactly as written', () => {
    expect(doc('<i><wp:post_type>post</wp:post_type></i>')).toEqual({
      i: { 'wp:post_type': 'post' },
    })
  })

  it('reads an empty element as empty text', () => {
    expect(doc('<i><wp:postmeta/></i>')).toEqual({ i: { 'wp:postmeta': '' } })
  })

  it('does not guess types: a slug that looks like a number stays text', () => {
    // `fast-xml-parser` answered 7 here, and 100000 for `1e5`. Everything downstream runs
    // `String()` over these, so guessing could only ever corrupt a value, never help one.
    expect(doc('<i><id>007</id><n>1e5</n></i>')).toEqual({ i: { id: '007', n: '1e5' } })
  })

  it('does not turn the newlines between tags into content', () => {
    expect(doc('<ch>\n  <t>x</t>\n  <u>y</u>\n</ch>')).toEqual({ ch: { t: 'x', u: 'y' } })
  })
})

describe('text, and what may be decoded', () => {
  it('decodes the five XML entities and leaves numeric references alone', () => {
    // `convert.ts` owns numeric decoding for every importer. Doing it here as well is how
    // `&amp;lt;` in a post body becomes a broken tag.
    expect(doc('<t>a &amp; b &lt;c&gt; &#7913;</t>')).toEqual({ t: 'a & b <c> &#7913;' })
  })

  it('leaves CDATA exactly as written', () => {
    const out = doc('<c><![CDATA[<p>a &amp; b</p>]]></c>')
    expect(out).toEqual({ c: '<p>a &amp; b</p>' })
  })

  it('joins CDATA with the text around it', () => {
    expect(doc('<c>before <![CDATA[&raw;]]> after</c>')).toEqual({ c: 'before &raw; after' })
  })

  it('decodes entities inside an attribute value', () => {
    expect(doc('<c n="a &amp; b">x</c>')).toEqual({ c: { '#text': 'x', '@_n': 'a & b' } })
  })
})

describe('the parts of a file that are not content', () => {
  it('skips comments and the prolog', () => {
    expect(doc('<?xml version="1.0"?><!-- generator --><a>x</a>')).toEqual({ a: 'x' })
  })

  it('skips a DOCTYPE whole, internal subset and all', () => {
    expect(doc('<!DOCTYPE rss [ <!ENTITY x "y"> ]><a>x</a>')).toEqual({ a: 'x' })
  })

  it('never expands an entity a DOCTYPE declares', () => {
    // The billion-laughs expansion and the external-entity read are both impossible here
    // rather than switched off: nothing in this parser defines an entity, so a reference to
    // one is text. If this ever passes by returning "hahahaha", something grew a DTD.
    const bomb = '<!DOCTYPE l [<!ENTITY lol "haha"><!ENTITY lol2 "&lol;&lol;">]><a>&lol2;</a>'
    expect(doc(bomb)).toEqual({ a: '&lol2;' })
  })

  it('does not end a tag at a > inside an attribute value', () => {
    expect(doc('<a t="1 > 0">x</a>')).toEqual({ a: { '#text': 'x', '@_t': '1 > 0' } })
  })
})

describe('a file that is not whole', () => {
  it('returns the items a truncated export did contain', () => {
    const cut = '<rss><channel><item><t>one</t></item><item><t>tw'
    const channel = (doc(cut).rss as XmlNode).channel as XmlNode
    expect((channel.item as XmlNode[])[0]).toEqual({ t: 'one' })
  })

  it('ignores a close tag that matches nothing open', () => {
    expect(doc('<a>x</b></a>')).toEqual({ a: 'x' })
  })

  it('refuses a document nested deeper than a real one ever is', () => {
    expect(() => doc('<a>'.repeat(200))).toThrow(/nested deeper/)
  })
})
