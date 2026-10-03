// A mail relay for the newsletter's tests: it takes every message, writes down who it was for, and
// can be told to go silent at the end of the Nth message, the moment a real relay has the message
// and the sender is waiting for its 250. That is the instant a restart makes a send uncertain, and
// the one the outbox (`news/outbox.ts`) exists to survive. Nothing leaves the loopback.
import net from 'node:net'

export type Relay = {
  port: number
  /** `RCPT TO` addresses, in arrival order: one entry per message a sender began. */
  rcpt: string[]
  /** Messages whose final `.` arrived, answered or not. */
  bodies: number
  /** Go silent after the final `.` of message `n` (1-based); 0 answers everything. */
  stallAt: (n: number) => void
  /** Forget everything seen, and answer everything again. */
  reset: () => void
  /** Resolves when message `n`'s final `.` has arrived. */
  received: (n: number) => Promise<void>
  close: () => void
}

export async function startRelay(): Promise<Relay> {
  const rcpt: string[] = []
  let bodies = 0
  let stall = 0
  const waiting: { n: number; done: () => void }[] = []
  const open = new Set<net.Socket>()
  const server = net.createServer((socket) => {
    open.add(socket)
    socket.on('close', () => open.delete(socket))
    let inData = false
    let pending = ''
    socket.on('error', () => {})
    socket.write('220 test relay\r\n')
    socket.on('data', (chunk) => {
      pending += chunk.toString('utf8')
      let at: number
      while ((at = pending.indexOf('\r\n')) >= 0) {
        const line = pending.slice(0, at)
        pending = pending.slice(at + 2)
        if (inData) {
          if (line !== '.') continue
          inData = false
          bodies++
          for (const w of waiting.filter((x) => x.n <= bodies)) w.done()
          if (stall && bodies === stall) return // the 250 never comes
          socket.write('250 queued\r\n')
          continue
        }
        const verb = line.slice(0, 4).toUpperCase()
        if (verb === 'EHLO') socket.write('250-test relay\r\n250 HELP\r\n')
        else if (verb === 'RCPT') {
          rcpt.push(line.replace(/^RCPT TO:<(.*)>$/i, '$1'))
          socket.write('250 ok\r\n')
        } else if (verb === 'DATA') {
          inData = true
          socket.write('354 go on\r\n')
        } else if (verb === 'QUIT') {
          socket.write('221 bye\r\n')
          socket.end()
        } else socket.write('250 ok\r\n')
      }
    })
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  return {
    port: (server.address() as net.AddressInfo).port,
    rcpt,
    get bodies() { return bodies },
    stallAt: (n) => { stall = n },
    reset: () => {
      rcpt.length = 0
      bodies = 0
      stall = 0
    },
    received: (n) => new Promise<void>((done) => {
      if (bodies >= n) done()
      else waiting.push({ n, done })
    }),
    close: () => {
      for (const s of open) s.destroy()
      server.close()
    },
  }
}
