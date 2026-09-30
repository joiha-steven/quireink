// The subscriber export's cells (2026-09-30): an address from the public form must never be a
// formula in the owner's spreadsheet.
import { describe, expect, it } from 'bun:test'
import { csvCell } from './subscriber-list'

describe('a CSV cell', () => {
  it('defuses anything a spreadsheet would evaluate', () => {
    expect(csvCell('=1+2@example.com')).toBe("'=1+2@example.com")
    expect(csvCell('+x@example.com')).toBe("'+x@example.com")
    expect(csvCell('-x@example.com')).toBe("'-x@example.com")
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)")
  })
  it('quotes what RFC 4180 says to, after defusing', () => {
    expect(csvCell('=HYPERLINK("x","y")')).toBe(`"'=HYPERLINK(""x"",""y"")"`)
    expect(csvCell('plain@example.com')).toBe('plain@example.com')
    expect(csvCell('a,b')).toBe('"a,b"')
  })
})
