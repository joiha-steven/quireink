// Cloudflare: a mail connection through `connect()` from `cloudflare:sockets`, upgraded in place
// with `startTls()`. Ports 587 and 465 work; 25 is blocked by the platform.
import { connect } from 'cloudflare:sockets'
import type { SocketPort, TextSocket } from '@/runtime/ports'

function wrap(socket: Socket, encrypted: boolean): TextSocket {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  const writer = socket.writable.getWriter()
  const reader = socket.readable.getReader()
  const listeners: { data?: (chunk: string) => void; end?: (error: Error | null) => void } = {}
  let early = ''
  let stopped = false
  void (async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done || stopped) break
        const text = decoder.decode(value, { stream: true })
        if (listeners.data) listeners.data(text)
        else early += text
      }
      if (!stopped) listeners.end?.(null)
    } catch (error) {
      if (!stopped) listeners.end?.(error as Error)
    }
  })()
  return {
    onData: (listener) => {
      listeners.data = listener
      if (early) { listener(early); early = '' }
    },
    onEnd: (listener) => { listeners.end = listener },
    write: (text) => { void writer.write(encoder.encode(text)) },
    startTls: async (host) => {
      stopped = true
      reader.releaseLock()
      writer.releaseLock()
      const secured = socket.startTls({ expectedServerHostname: host })
      await secured.opened
      return wrap(secured, true)
    },
    close: () => {
      stopped = true
      void socket.close()
    },
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
