// `isIP` answers exactly what `node:net` answers, on the spellings an SSRF guard meets.
import { describe, expect, it } from 'bun:test'
import { isIP as nodeIsIP } from 'node:net'
import { isIP } from '@/server/ip'

const CASES = [
  '127.0.0.1', '0.0.0.0', '255.255.255.255', '256.1.1.1', '01.2.3.4', '1.2.3', '1.2.3.4.5', '1.2.3.-4',
  '169.254.169.254', '10.0.0.1', '::', '::1', 'fe80::1', 'fc00::', '2001:db8::1', '::ffff:127.0.0.1',
  '2001:0db8:0000:0000:0000:ff00:0042:8329', '1:2:3:4:5:6:7:8', '1:2:3:4:5:6:7:8:9', ':::', '1::2::3',
  'example.com', 'localhost', '', ' 127.0.0.1', '[::1]', 'gggg::1', '1.2.3.4/32',
]

describe('isIP', () => {
  for (const c of CASES) {
    it(`agrees with node:net on ${JSON.stringify(c)}`, () => expect(isIP(c)).toBe(nodeIsIP(c) as 0 | 4 | 6))
  }
})
