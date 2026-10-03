// The Cloudflare REST API, as much of it as installing and upgrading a blog needs. Every call says
// which step it belongs to, so a failure reads as "the bucket could not be created: <Cloudflare's
// words>" rather than as a status code (G5.3).
export class CloudflareError extends Error {
  constructor(readonly step: string, readonly status: number, message: string) {
    super(`${step}: ${message}`)
  }
}

type Envelope<T> = { success: boolean; result: T; errors?: { code: number; message: string }[] }

export class CloudflareApi {
  constructor(
    private readonly token: string,
    readonly accountId: string,
    private readonly base = 'https://api.cloudflare.com/client/v4',
  ) {}

  async call<T>(step: string, path: string, init: RequestInit = {}, token = this.token): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.base}${path.replace(':account', this.accountId)}`
    const res = await fetch(url, { ...init, headers: { authorization: `Bearer ${token}`, ...(init.headers ?? {}) } })
    let body: Envelope<T> | null = null
    try {
      body = (await res.json()) as Envelope<T>
    } catch {
      /* not JSON: say the status */
    }
    if (!res.ok || !body?.success) {
      const said = body?.errors?.map((e) => `${e.message} (${e.code})`).join('; ') || `HTTP ${res.status}`
      throw new CloudflareError(step, res.status, said)
    }
    return body.result
  }

  json<T>(step: string, path: string, method: string, payload: unknown): Promise<T> {
    return this.call<T>(step, path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
  }
}
