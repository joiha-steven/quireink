// SMTP, spoken directly. The other half of retiring `nodemailer`; `mime.ts` builds what this
// carries.
//
// The protocol is small: greet, EHLO, maybe upgrade, maybe authenticate, then MAIL/RCPT/DATA per
// message and QUIT. What makes it worth writing carefully is that every reply is a number, and a
// client that reads `250` where the server said `450` reports a delivery that did not happen.
// Nothing here treats a reply as optional: every command waits for its code, and any code that
// is not the expected one throws with what the server actually said.
//
// ONE THING IS STRICTER THAN `nodemailer` WAS. If credentials are configured and the connection
// is neither implicit TLS nor upgraded by STARTTLS, this refuses to authenticate rather than
// putting the password on the wire in the clear. The exception is a loopback host, where there
// is no wire to put it on; a blog relaying through `127.0.0.1` keeps working.
import { mailHostname, openSocket } from '@/runtime/impl/socket'
import type { TextSocket } from '@/runtime/ports'

export type SmtpOptions = {
  host: string
  port: number
  /** True for implicit TLS, which is what port 465 means. False starts plain and may upgrade. */
  secure: boolean
  auth?: { user: string; pass: string }
  /** Per command. A relay that stops answering must not hold a broadcast open. */
  timeoutMs?: number
}

export class SmtpError extends Error {
  constructor(readonly code: number, message: string) {
    super(message)
    this.name = 'SmtpError'
  }
}

const DEFAULT_TIMEOUT = 30_000

/** A reply: its code, and the text of every line, continuation lines included. */
type Reply = { code: number; lines: string[] }

const isLoopback = (host: string): boolean =>
  host === 'localhost' || host === '::1' || /^127\./.test(host)

/**
 * The socket, as one thing that can be written to, read a reply from, and upgraded.
 *
 * Replies arrive in whatever chunks the network felt like, so reads are served from a buffer:
 * a reply is complete at the first line whose three digits are followed by a SPACE, because a
 * hyphen there means another line is coming.
 */
class Wire {
  private buffer = ''
  /** A read that outlived a timeout, kept so what it brings is not lost to the next one. */
  private pending: Promise<string | null> | null = null

  constructor(private socket: TextSocket, private readonly timeoutMs: number) {}

  /** A whole reply off the front of the buffer, or null while it is still arriving. */
  private take(): Reply | null {
    const end = /^(\d{3}) [^\n]*\r?\n/m.exec(this.buffer)
    if (!end) return null
    // ⚠️ CUT WHERE THE MATCH IS, not where the TEXT first appears. `indexOf` finds the earliest
    // copy of the final line's text, and a multi-line reply whose continuation happens to carry
    // the same characters would be cut in the wrong place, leaving half a reply in the buffer to
    // be read as the answer to the NEXT command. `end.index` is where the regex actually matched.
    const at = end.index + end[0].length
    const block = this.buffer.slice(0, at)
    this.buffer = this.buffer.slice(at)
    return {
      code: Number(end[1]),
      lines: block.split(/\r?\n/).filter(Boolean).map((line) => line.slice(4)),
    }
  }

  /**
   * The next reply. Reads only from here, so nothing is read while nothing is awaited — which is
   * what lets STARTTLS hand the connection over (`TextSocket.read` in runtime/ports.ts).
   */
  async read(): Promise<Reply> {
    const deadline = Date.now() + this.timeoutMs
    for (;;) {
      const reply = this.take()
      if (reply) return reply
      this.pending ??= this.socket.read()
      let timer: ReturnType<typeof setTimeout> | undefined
      const late = new Promise<'late'>((resolve) => {
        timer = setTimeout(() => resolve('late'), Math.max(0, deadline - Date.now()))
      })
      let chunk: string | null | 'late'
      try {
        chunk = await Promise.race([this.pending, late])
      } catch (error) {
        this.pending = null
        throw error
      } finally {
        clearTimeout(timer)
      }
      if (chunk === 'late') throw new SmtpError(0, `the server did not answer within ${this.timeoutMs}ms`)
      this.pending = null
      if (chunk === null) throw new SmtpError(0, 'the server closed the connection')
      this.buffer += chunk
    }
  }

  write(line: string): void {
    this.socket.write(line)
  }

  /** STARTTLS: the same TCP connection, from here on encrypted. */
  async upgrade(host: string): Promise<void> {
    this.socket = await this.socket.startTls(host)
    this.buffer = ''
  }

  end(): void {
    this.socket.close()
  }

  get encrypted(): boolean {
    return this.socket.encrypted
  }
}

/** Opens the socket, plain or wrapped (the runtime's: `@/runtime/impl/socket`). */
async function connect(opts: SmtpOptions, timeoutMs: number): Promise<Wire> {
  try {
    return new Wire(await openSocket({ host: opts.host, port: opts.port, secure: opts.secure }, timeoutMs), timeoutMs)
  } catch (error) {
    const message = (error as Error).message
    throw message.startsWith('could not reach') ? new SmtpError(0, message) : error
  }
}

/** One connection, good for as many messages as the caller has. */
export class SmtpSession {
  private constructor(private readonly wire: Wire, private readonly host: string) {}

  private static async say(wire: Wire, line: string, want: number[]): Promise<Reply> {
    wire.write(`${line}\r\n`)
    const reply = await wire.read()
    if (!want.includes(reply.code)) {
      // The command is named but never its argument: an AUTH line carries the password.
      const what = line.split(' ')[0]
      throw new SmtpError(reply.code, `${what} was refused: ${reply.code} ${reply.lines.join(' ')}`)
    }
    return reply
  }

  static async open(opts: SmtpOptions): Promise<SmtpSession> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT
    const wire = await connect(opts, timeoutMs)
    try {
      const greeting = await wire.read()
      if (greeting.code !== 220) {
        throw new SmtpError(greeting.code, `the server did not greet: ${greeting.lines.join(' ')}`)
      }
      const me = mailHostname()
      let caps = (await SmtpSession.say(wire, `EHLO ${me}`, [250])).lines

      if (!opts.secure && caps.some((line) => /^STARTTLS\b/i.test(line))) {
        await SmtpSession.say(wire, 'STARTTLS', [220])
        await wire.upgrade(opts.host)
        // The capability list is re-read because it is allowed to change, and does: most relays
        // advertise no AUTH mechanism at all until the connection is encrypted.
        caps = (await SmtpSession.say(wire, `EHLO ${me}`, [250])).lines
      }

      if (opts.auth?.user) {
        if (!wire.encrypted && !isLoopback(opts.host)) {
          throw new SmtpError(
            0,
            `${opts.host} offered no STARTTLS, and a password will not be sent unencrypted`,
          )
        }
        await SmtpSession.authenticate(wire, caps, opts.auth)
      }
      return new SmtpSession(wire, opts.host)
    } catch (error) {
      wire.end()
      throw error
    }
  }

  private static async authenticate(
    wire: Wire,
    caps: readonly string[],
    auth: { user: string; pass: string },
  ): Promise<void> {
    const offered = caps.find((line) => /^AUTH\b/i.test(line))?.toUpperCase() ?? ''
    const b64 = (value: string): string => Buffer.from(value, 'utf8').toString('base64')
    // PLAIN when it is offered or when nothing is: it is one round trip, and a relay that
    // advertises no mechanism list still usually takes it.
    if (!offered.includes('LOGIN') || offered.includes('PLAIN')) {
      await SmtpSession.say(wire, `AUTH PLAIN ${b64(`\0${auth.user}\0${auth.pass}`)}`, [235])
      return
    }
    await SmtpSession.say(wire, 'AUTH LOGIN', [334])
    await SmtpSession.say(wire, b64(auth.user), [334])
    await SmtpSession.say(wire, b64(auth.pass), [235])
  }

  /** One message. `body` is the whole thing, headers included, exactly as it should arrive. */
  async send(envelope: { from: string; to: string; body: string }): Promise<void> {
    await SmtpSession.say(this.wire, `MAIL FROM:<${envelope.from}>`, [250])
    await SmtpSession.say(this.wire, `RCPT TO:<${envelope.to}>`, [250, 251])
    await SmtpSession.say(this.wire, 'DATA', [354])
    // DOT-STUFFING. A line that is a single `.` ends the message, so a line that STARTS with one
    // gets a second and the receiver takes it away again. It applies to the headers too, which
    // is why it is done here rather than inside the encoder.
    const stuffed = envelope.body.replace(/\r\n\./g, '\r\n..').replace(/^\./, '..')
    this.wire.write(stuffed.endsWith('\r\n') ? `${stuffed}.\r\n` : `${stuffed}\r\n.\r\n`)
    const reply = await this.wire.read()
    if (reply.code !== 250) {
      throw new SmtpError(reply.code, `the message was refused: ${reply.code} ${reply.lines.join(' ')}`)
    }
  }

  /** QUIT, then the socket. A server that will not say goodbye is not worth waiting for. */
  async close(): Promise<void> {
    try {
      await SmtpSession.say(this.wire, 'QUIT', [221])
    } catch {
      // Nothing to do about it, and the caller has already sent what it came to send.
    } finally {
      this.wire.end()
    }
  }

  get server(): string {
    return this.host
  }
}
