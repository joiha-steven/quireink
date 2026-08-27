// The Google half of comment sign-in: build the authorize URL, then turn the code Google
// sends back into a name and an email address.
//
// Scope is `openid email profile` and nothing else. This asks for the reader's identity and
// no access to anything they own, which is the entire reason a reader would agree to it.
//
// Deliberately NOT here: refresh tokens, token storage, a Google API client. The access
// token is used for nothing — the identity arrives inside the id_token in the same
// response — so it is read once and dropped. Nothing Google issued is ever stored.

const AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN = 'https://oauth2.googleapis.com/token'
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com']

export type GoogleIdentity = { name: string; email: string }

/** Where Google sends the reader back. Registered in the Google console, byte for byte. */
export const CALLBACK_PATH = '/comment-auth/google/callback'

export const callbackUrl = (origin: string): string => `${origin}${CALLBACK_PATH}`

/**
 * The URL to send the reader to.
 *
 * `prompt=select_account` rather than the default: a household or an office share a browser
 * profile more often than this kind of code assumes, and silently reusing whichever Google
 * account is already signed in publishes a comment under the wrong name.
 */
export function authorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  })
  return `${AUTHORIZE}?${q}`
}

type TokenResponse = { id_token?: string }

type IdToken = {
  iss?: string
  aud?: string
  exp?: number
  email?: string
  email_verified?: boolean
  name?: string
}

/** The middle segment of a JWT, decoded. No signature check here — see `exchangeCode`. */
function decodeClaims(idToken: string): IdToken | null {
  const body = idToken.split('.')[1]
  if (!body) return null
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as IdToken
  } catch {
    return null
  }
}

/**
 * The identity an id_token asserts, or throw.
 *
 * **The signature is not verified, on purpose.** This token did not arrive through the
 * browser; it came back on this server's own TLS connection to Google's token endpoint, in
 * the direct response to a request carrying the client secret. OpenID Connect Core §3.1.3.7
 * says a client MAY skip signature validation in exactly that case, and taking the other
 * road means fetching, caching and rotating Google's JWKS to re-prove what TLS just proved.
 *
 * The claims are still checked, because those say something TLS does not: `aud` that this
 * token was minted for THIS client rather than replayed from another site's flow, `iss` that
 * it is Google's, `exp` that it is current, and `email_verified` that Google has actually
 * seen the address rather than merely been told it.
 *
 * Separate from the exchange, and exported, so those four checks can be tested without a
 * network. They are the whole security of this flow.
 */
export function identityFromIdToken(idToken: string, clientId: string): GoogleIdentity {
  const claims = decodeClaims(idToken)
  if (!claims) throw new Error('google id_token could not be decoded')
  if (!ISSUERS.includes(claims.iss ?? '')) throw new Error('google id_token has a foreign issuer')
  if (claims.aud !== clientId) throw new Error('google id_token was issued for another client')
  if (!claims.exp || claims.exp * 1000 <= Date.now()) throw new Error('google id_token has expired')
  if (!claims.email || claims.email_verified !== true) {
    throw new Error('google id_token carries no verified email')
  }

  // A comment shows a name. Google always sends one for a `profile` scope, but the address
  // is a decent fallback and an empty byline is not.
  return { name: (claims.name || claims.email.split('@')[0]!).slice(0, 80), email: claims.email }
}

/** Trade the authorization code for the reader's identity, or throw. */
export async function exchangeCode(
  code: string, clientId: string, clientSecret: string, redirectUri: string,
): Promise<GoogleIdentity> {
  const res = await fetch(TOKEN, {
    method: 'POST',
    // The reader is sitting on the callback URL while this runs. Google not answering has
    // to become a failed sign-in, not a request that never returns.
    signal: AbortSignal.timeout(10_000),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`google token exchange failed: ${res.status}`)

  const { id_token: idToken } = (await res.json()) as TokenResponse
  if (!idToken) throw new Error('google token exchange returned no id_token')
  return identityFromIdToken(idToken, clientId)
}
