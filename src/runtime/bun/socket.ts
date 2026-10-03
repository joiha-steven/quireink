// Bun: a mail connection over `node:net`, upgraded or opened with `node:tls`. Lifted out of
// `news/smtp.ts` (2026-10-03, ADR 0066) with its two lessons, so the protocol there no longer knows
// which runtime it speaks through.
import net from 'node:net'
import os from 'node:os'
import tls from 'node:tls'
import type { SocketPort, TextSocket } from '@/runtime/ports'

/**
 * The name to put in the TLS handshake, or nothing.
 *
 * SNI carries a HOSTNAME, and `tls.connect` throws outright when handed an IP literal rather
 * than quietly ignoring it. A relay configured by address is an ordinary thing to configure —
 * a box on the same network, a VPS with no name yet — and without this the upgrade throws
 * before a single message goes out. Found by pointing the client at 127.0.0.1.
 */
const sniFor = (host: string): string | undefined =>
  /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':') ? undefined : host

function wrap(socket: net.Socket | tls.TLSSocket): TextSocket {
  socket.setEncoding('utf8')
  // Node pushes; the port pulls (ports.ts, `read`). What arrives between reads waits here.
  const chunks: string[] = []
  let ended: { error: Error | null } | null = null
  let wake: (() => void) | null = null
  const nudge = () => {
    const w = wake
    wake = null
    w?.()
  }
  const onData = (chunk: string) => { chunks.push(chunk); nudge() }
  const onError = (error: Error) => { ended ??= { error }; nudge() }
  const onClose = () => { ended ??= { error: null }; nudge() }
  socket.on('data', onData)
  socket.on('error', onError)
  socket.on('close', onClose)
  return {
    read: async () => {
      for (;;) {
        if (chunks.length) return chunks.shift()!
        if (ended) {
          if (ended.error) throw ended.error
          return null
        }
        await new Promise<void>((resolve) => { wake = resolve })
      }
    },
    write: (text) => { socket.write(text) },
    startTls: (host) => new Promise((resolve, reject) => {
      socket.off('data', onData)
      socket.off('error', onError)
      socket.off('close', onClose)
      const secured = tls.connect({ socket: socket as net.Socket, servername: sniFor(host) }, () => resolve(wrap(secured)))
      secured.once('error', reject)
    }),
    close: () => {
      socket.removeAllListeners()
      socket.destroy()
    },
    get encrypted() { return socket instanceof tls.TLSSocket },
  }
}

export const openSocket: SocketPort['openSocket'] = (opts, timeoutMs) => new Promise((resolve, reject) => {
  const socket = opts.secure
    ? tls.connect({ host: opts.host, port: opts.port, servername: sniFor(opts.host) })
    : net.connect({ host: opts.host, port: opts.port })
  const timer = setTimeout(() => {
    socket.destroy()
    reject(new Error(`could not reach ${opts.host}:${opts.port} within ${timeoutMs}ms`))
  }, timeoutMs)
  socket.once('error', (error: Error) => {
    clearTimeout(timer)
    reject(error)
  })
  socket.once(opts.secure ? 'secureConnect' : 'connect', () => {
    clearTimeout(timer)
    socket.removeAllListeners('error')
    resolve(wrap(socket))
  })
})

export const mailHostname: SocketPort['mailHostname'] = () => os.hostname() || 'localhost'
