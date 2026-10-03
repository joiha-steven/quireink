// Cloudflare: a mail connection through `connect()` from `cloudflare:sockets`, upgraded in place
// with `startTls()`. Ports 587 and 465 work; 25 is blocked by the platform.
import { connect } from 'cloudflare:sockets'
import type { SocketPort, TextSocket } from '@/runtime/ports'

function wrap(socket: Socket, encrypted: boolean): TextSocket {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  const writer = socket.writable.getWriter()
  const reader = socket.readable.getReader()
  return {
    read: async () => {
      const { done, value } = await reader.read()
      if (done) return null
      return decoder.decode(value, { stream: true })
    },
    // A failed write is the connection failing, and the next read reports that.
    write: (text) => { writer.write(encoder.encode(text)).catch(() => {}) },
    startTls: async () => {
      // Both locks go back before the upgrade, which workerd requires — and can only do because no
      // read is outstanding here (ports.ts, `read`). No `expectedServerHostname`: local workerd
      // refuses the option, and the certificate is checked against the host given to `connect()`,
      // which is the same host.
      reader.releaseLock()
      writer.releaseLock()
      const secured = socket.startTls()
      await secured.opened
      return wrap(secured, true)
    },
    close: () => { void socket.close() },
    encrypted,
  }
}

export const openSocket: SocketPort['openSocket'] = async (opts, timeoutMs) => {
  const socket = connect({ hostname: opts.host, port: opts.port }, { secureTransport: opts.secure ? 'on' : 'starttls', allowHalfOpen: false })
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`could not reach ${opts.host}:${opts.port} within ${timeoutMs}ms`)), timeoutMs)
  })
  try {
    await Promise.race([socket.opened, late])
  } finally {
    clearTimeout(timer)
  }
  return wrap(socket, opts.secure)
}

// The name the blog gives itself in EHLO. A Worker has no hostname; the site's own address is the
// honest one, and the SMTP server only uses it for its logs.
export const mailHostname: SocketPort['mailHostname'] = () => {
  try {
    return new URL(process.env.SITE_URL ?? '').hostname || 'quireink.invalid'
  } catch {
    return 'quireink.invalid'
  }
}
