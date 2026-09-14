// The SMTP client, against a server that records what it was told.
//
// No mail is sent by anything in this file. The server below is twenty lines of `node:net` that
// answers from a script and keeps a transcript, so every assertion is about the bytes this
// client put on the wire.
//
// ⚠️ THE UPGRADE ITSELF IS NOT IN THIS SUITE, AND HERE IS WHY AND HOW IT WAS PROVED INSTEAD.
//
// A STARTTLS test needs a server that can turn an open socket into a TLS one mid-conversation,
// and Bun cannot: `new tls.TLSSocket(socket, { isServer: true })` never finishes its handshake,
// measured both ways round on 2026-09-14, with and without a `secureContext`. OpenSSL 3.6 no
// longer has `s_server -starttls` either. The CLIENT half is what this module uses and it works.
//
// So it was run by hand against a Node server, which can, and this was the transcript:
//
//   ["EHLO host", "STARTTLS", "TLS:EHLO host", "TLS:QUIT"]
//
// The last two lines arriving on the TLS side is the proof: the same TCP connection carried
// them after the upgrade. To repeat it, from the repository root:
//
//   openssl req -x509 -newkey rsa:2048 -keyout .tmp/k.pem -out .tmp/c.pem \
//     -days 2 -nodes -subj "/CN=localhost"
//   # a Node script: net.createServer, answer EHLO with 250 STARTTLS, then
//   # new tls.TLSSocket(socket, { isServer: true, secureContext }) and log what arrives
//   NODE_EXTRA_CA_CERTS=$PWD/.tmp/c.pem bun -e "…SmtpSession.open({host:'127.0.0.1',…})"
//
// `NODE_EXTRA_CA_CERTS` is needed because this client VALIDATES certificates and a test one is
// self-signed. That is the correct default and there is deliberately no option to turn it off:
// an option the settings screen cannot set is an option nobody has decided to use.
//
// That run is also what found the SNI bug pinned below.
import { afterEach, describe, expect, it } from 'bun:test'
import net from 'node:net'
import os from 'node:os'
import { SmtpError, SmtpSession } from './smtp'

type Fake = {
  port: number
  said: string[]
  close: () => void
}

/**
 * A server that answers each command from `script` and writes down what it heard.
 *
 * `script` is looked up by the first word, uppercased. `220-greeting` is sent on connect. The
 * message body after DATA is recorded as one entry beginning `BODY:`.
 */
async function fakeServer(script: Record<string, string>, host = '127.0.0.1'): Promise<Fake> {
  const said: string[] = []
  const server = net.createServer((socket) => {
    let inData = false
    let body = ''
    socket.setEncoding('utf8')
    socket.write('220 fake ESMTP ready\r\n')
    socket.on('data', (chunk: string) => {
      if (inData) {
        body += chunk
        if (!body.includes('\r\n.\r\n')) return
        said.push(`BODY:${body.slice(0, body.indexOf('\r\n.\r\n'))}`)
        inData = false
        body = ''
        socket.write(`${script.BODY ?? '250 queued'}\r\n`)
        return
      }
      for (const line of chunk.split('\r\n').filter(Boolean)) {
        said.push(line)
        // The raw line is tried BEFORE the uppercased verb: an AUTH LOGIN exchange answers
        // with base64, and `bWU=` uppercased is a different string entirely.
        const verb = line.split(' ')[0]!.toUpperCase()
        const answer = script[line] ?? script[verb] ?? '250 ok'
        if (verb === 'DATA' && answer.startsWith('354')) inData = true
        socket.write(`${answer}\r\n`)
        if (verb === 'QUIT') socket.end()
      }
    })
    socket.on('error', () => {})
  })
  await new Promise<void>((done) => server.listen(0, host, done))
  return {
    port: (server.address() as net.AddressInfo).port,
    said,
    close: () => server.close(),
  }
}

const EHLO_PLAIN = '250-fake greets you\r\n250-SIZE 35882577\r\n250-AUTH PLAIN LOGIN\r\n250 HELP'
const OPEN = { EHLO: EHLO_PLAIN, DATA: '354 go ahead' }

let running: Fake | null = null
afterEach(() => {
  running?.close()
  running = null
})

async function session(script: Record<string, string>, auth?: { user: string; pass: string }) {
  running = await fakeServer(script)
  return SmtpSession.open({ host: '127.0.0.1', port: running.port, secure: false, auth, timeoutMs: 4000 })
}

describe('one message, end to end', () => {
  it('walks the whole conversation in order', async () => {
    const smtp = await session(OPEN)
    await smtp.send({ from: 'hi@example.com', to: 'reader@example.org', body: 'Subject: x\r\n\r\nBody.\r\n' })
    await smtp.close()
    expect(running!.said.filter((l) => !l.startsWith('BODY:'))).toEqual([
      `EHLO ${os.hostname() || 'localhost'}`,
      'MAIL FROM:<hi@example.com>',
      'RCPT TO:<reader@example.org>',
      'DATA',
      'QUIT',
    ])
  })

  it('delivers the body the caller handed it, byte for byte', async () => {
    const smtp = await session(OPEN)
    await smtp.send({ from: 'a@b.c', to: 'd@e.f', body: 'Subject: Bản tin\r\n\r\nChào bạn.\r\n' })
    await smtp.close()
    expect(running!.said.find((l) => l.startsWith('BODY:'))).toBe(
      'BODY:Subject: Bản tin\r\n\r\nChào bạn.',
    )
  })

  it('reuses one connection for several messages', async () => {
    const smtp = await session(OPEN)
    for (const to of ['a@x.com', 'b@x.com', 'c@x.com']) {
      await smtp.send({ from: 'hi@x.com', to, body: 'Subject: x\r\n\r\nhi\r\n' })
    }
    await smtp.close()
    expect(running!.said.filter((l) => l.startsWith('EHLO')).length).toBe(1)
    expect(running!.said.filter((l) => l.startsWith('RCPT')).length).toBe(3)
  })

  it('doubles a leading dot so the message cannot end itself early', async () => {
    const smtp = await session(OPEN)
    await smtp.send({ from: 'a@b.c', to: 'd@e.f', body: 'Subject: x\r\n\r\nbefore\r\n.\r\nafter\r\n' })
    await smtp.close()
    const body = running!.said.find((l) => l.startsWith('BODY:'))!
    expect(body).toContain('\r\n..\r\n')
    // And the server, undoing the stuffing as a real one does, gets back what was written.
    expect(body.slice(5).replace(/\r\n\.\./g, '\r\n.')).toBe('Subject: x\r\n\r\nbefore\r\n.\r\nafter')
  })
})

describe('authentication', () => {
  it('uses PLAIN in one round trip when the server offers it', async () => {
    const smtp = await session({ ...OPEN, AUTH: '235 accepted' }, { user: 'me', pass: 'secret' })
    await smtp.close()
    const line = running!.said.find((l) => l.startsWith('AUTH'))!
    expect(line.startsWith('AUTH PLAIN ')).toBe(true)
    expect(Buffer.from(line.slice(11), 'base64').toString()).toBe('\0me\0secret')
  })

  it('falls back to LOGIN when that is all the server has', async () => {
    running = await fakeServer({
      EHLO: '250-fake\r\n250 AUTH LOGIN',
      AUTH: '334 VXNlcm5hbWU6',
      'bWU=': '334 UGFzc3dvcmQ6',
      'c2VjcmV0': '235 accepted',
      DATA: '354 go ahead',
    })
    const smtp = await SmtpSession.open({
      host: '127.0.0.1', port: running.port, secure: false,
      auth: { user: 'me', pass: 'secret' }, timeoutMs: 4000,
    })
    await smtp.close()
    expect(running.said).toContain('AUTH LOGIN')
    expect(running.said).toContain('bWU=')
    expect(running.said).toContain('c2VjcmV0')
  })

  it('never puts the password into the error it throws', async () => {
    const attempt = session({ ...OPEN, AUTH: '535 bad credentials' }, { user: 'me', pass: 'hunter2' })
    await expect(attempt).rejects.toThrow(/AUTH was refused: 535/)
    await attempt.catch((error: Error) => {
      expect(error.message).not.toContain('hunter2')
      expect(error.message).not.toContain(Buffer.from('\0me\0hunter2').toString('base64'))
    })
  })

  it('sends no password at all to a server across the network with no STARTTLS', async () => {
    // The rule this pins: credentials may cross a network only under TLS. `nodemailer` would
    // have sent them. A loopback host is exempt, which is why the address is found rather than
    // hardcoded, and why the test says so when the machine has none.
    const lan = Object.values(os.networkInterfaces())
      .flat()
      .find((i) => i && i.family === 'IPv4' && !i.internal)?.address
    if (!lan) {
      expect('no non-loopback address on this machine').toBeTruthy()
      return
    }
    running = await fakeServer({ EHLO: '250-fake\r\n250 AUTH PLAIN' }, lan)
    const attempt = SmtpSession.open({
      host: lan, port: running.port, secure: false,
      auth: { user: 'me', pass: 'secret' }, timeoutMs: 4000,
    })
    await expect(attempt).rejects.toThrow(/will not be sent unencrypted/)
    expect(running.said.some((l) => l.startsWith('AUTH'))).toBe(false)
  })

  it('takes the same password to a loopback relay, where there is no wire', async () => {
    const smtp = await session({ ...OPEN, AUTH: '235 accepted' }, { user: 'me', pass: 'secret' })
    await smtp.close()
    expect(running!.said.some((l) => l.startsWith('AUTH PLAIN'))).toBe(true)
  })
})

describe('a server that says no', () => {
  it('asks for STARTTLS when it is offered, before anything else', async () => {
    running = await fakeServer({
      EHLO: '250-fake\r\n250 STARTTLS',
      STARTTLS: '454 not really',
    })
    const attempt = SmtpSession.open({ host: '127.0.0.1', port: running.port, secure: false, timeoutMs: 4000 })
    await expect(attempt).rejects.toThrow(/STARTTLS was refused: 454/)
    expect(running.said[1]).toBe('STARTTLS')
  })

  it('does not choke on a relay configured by IP address rather than by name', async () => {
    // SNI carries a hostname, and `tls.connect` THROWS when handed an IP literal instead of
    // ignoring it. A relay on a LAN box or a nameless VPS is configured by address every day,
    // and before this was fixed the upgrade threw before a single message went out. The fake
    // server here says 220 and then is not TLS, so the handshake fails either way; what this
    // pins is that it fails as a handshake and not as an argument.
    running = await fakeServer({ EHLO: '250-fake\r\n250 STARTTLS', STARTTLS: '220 go ahead' })
    const attempt = SmtpSession.open({ host: '127.0.0.1', port: running.port, secure: false, timeoutMs: 2000 })
    await expect(attempt).rejects.toThrow()
    await attempt.catch((error: Error) => {
      expect(error.message).not.toContain('ServerName')
      expect(error.message).not.toContain('not permitted')
    })
  })

  it('carries the code and the text of a refused recipient', async () => {
    const smtp = await session({ ...OPEN, RCPT: '550 no such mailbox' })
    const attempt = smtp.send({ from: 'a@b.c', to: 'nobody@x.y', body: 'Subject: x\r\n\r\nhi\r\n' })
    await expect(attempt).rejects.toThrow(/RCPT was refused: 550 no such mailbox/)
    await attempt.catch((error) => expect((error as SmtpError).code).toBe(550))
    await smtp.close()
  })

  it('carries a refusal of the message itself', async () => {
    const smtp = await session({ ...OPEN, BODY: '552 message too large' })
    const attempt = smtp.send({ from: 'a@b.c', to: 'd@e.f', body: 'Subject: x\r\n\r\nhi\r\n' })
    await expect(attempt).rejects.toThrow(/refused: 552 message too large/)
    await smtp.close()
  })

  it('reads a multi-line greeting as one reply', async () => {
    // Four continuation lines then a final one. A client that takes the first line as the whole
    // reply reads the next command's answer as this one's, and every code after is off by one.
    const smtp = await session(OPEN)
    await smtp.close()
    expect(running!.said[0]!.startsWith('EHLO')).toBe(true)
    expect(running!.said[1]).toBe('QUIT')
  })

  it('gives up on a server that stops answering', async () => {
    running = await fakeServer({ EHLO: EHLO_PLAIN, MAIL: '' })
    const smtp = await SmtpSession.open({ host: '127.0.0.1', port: running.port, secure: false, timeoutMs: 300 })
    const attempt = smtp.send({ from: 'a@b.c', to: 'd@e.f', body: 'x\r\n' })
    await expect(attempt).rejects.toThrow(/did not answer within 300ms/)
  })

  it('gives up on a host that is not listening', async () => {
    const attempt = SmtpSession.open({ host: '127.0.0.1', port: 9, secure: false, timeoutMs: 500 })
    await expect(attempt).rejects.toThrow()
  })
})
