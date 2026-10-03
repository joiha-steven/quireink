// Fixed WebAuthn vectors: one passkey per algorithm, registered and then used once.
//
// Made ONCE by the software authenticator in `src/test/webauthn.ts` and frozen here, so the
// verifier is held to bytes that do not change between runs: a decoder that drifts fails against
// the same attestation every time, not against a fresh one it might happen to agree with. ECDSA
// and RSA signatures are randomised, which is exactly why they are written down rather than made
// again.
//
// Read by `src/auth/webauthn.test.ts` under Bun and by `scripts/cf-test/passkey.ts` inside
// workerd: the same bytes must verify on both runtimes.

export const RP_ID = 'blog.example'
export const ORIGIN = 'https://blog.example'
/** The challenges the registration and the sign-in answered, base64url. */
export const REGISTER_CHALLENGE = 'cmVnaXN0ZXItY2hhbGxlbmdlLWZvci10aGUtdGVzdHM'
export const SIGN_IN_CHALLENGE = 'c2lnbi1pbi1jaGFsbGVuZ2UtZm9yLXRoZS10ZXN0cw'

export type Vector = {
  credentialId: string
  /** The COSE public key, as the attestation carries it. */
  cose: string
  attClientData: string
  attestationObject: string
  getClientData: string
  authenticatorData: string
  signature: string
  /** The counter the assertion carries. */
  signCount: number
}

export const VECTORS: Record<'es256' | 'eddsa' | 'rs256', Vector> = {
  es256: {
    credentialId: 'WGeK9p5hdqJFfONzsh5J-d5S4if3QDgSEtgobb5ojK0',
    cose: 'pQECAyYgASFYIB76rKKwnshYY-fJj7tuTQaHhK6eNdLM6SQV1oyrjxQdIlggzF-ZuTThyZOW_0TT-BG0cNUNXUXyhgdn8m4QOjliLKQ',
    attClientData: 'eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoiY21WbmFYTjBaWEl0WTJoaGJHeGxibWRsTFdadmNpMTBhR1V0ZEdWemRITSIsIm9yaWdpbiI6Imh0dHBzOi8vYmxvZy5leGFtcGxlIiwiY3Jvc3NPcmlnaW4iOmZhbHNlfQ',
    attestationObject: 'o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YVikBQcGz7ug1mJmV_fo9YnB07iSY5RTDKFGRLaqzyXxoaBFAAAAAAAAAAAAAAAAAAAAAAAAAAAAIFhnivaeYXaiRXzjc7IeSfneUuIn90A4EhLYKG2-aIytpQECAyYgASFYIB76rKKwnshYY-fJj7tuTQaHhK6eNdLM6SQV1oyrjxQdIlggzF-ZuTThyZOW_0TT-BG0cNUNXUXyhgdn8m4QOjliLKQ',
    getClientData: 'eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiYzJsbmJpMXBiaTFqYUdGc2JHVnVaMlV0Wm05eUxYUm9aUzEwWlhOMGN3Iiwib3JpZ2luIjoiaHR0cHM6Ly9ibG9nLmV4YW1wbGUiLCJjcm9zc09yaWdpbiI6ZmFsc2V9',
    authenticatorData: 'BQcGz7ug1mJmV_fo9YnB07iSY5RTDKFGRLaqzyXxoaAFAAAABw',
    signature: 'MEUCIQDS5rimkQAk7zmFy_FjUwHB-OXGjXLanb-4O0GyLa9t1AIgZH9g2hnD4_V-JbO1ww7Z-vB4pAJj4tF4GJkhuVk1B3E',
    signCount: 7,
  },
  eddsa: {
    credentialId: '7QFFaY1W8pGdga459qG73tJiASZuPLn4MWUIYAXdKkY',
    cose: 'pAEBAycgBiFYIAJTbgP8VkgRT0Y-nev2bh8aCoRpE03Jm1DzqFBtmmwy',
    attClientData: 'eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoiY21WbmFYTjBaWEl0WTJoaGJHeGxibWRsTFdadmNpMTBhR1V0ZEdWemRITSIsIm9yaWdpbiI6Imh0dHBzOi8vYmxvZy5leGFtcGxlIiwiY3Jvc3NPcmlnaW4iOmZhbHNlfQ',
    attestationObject: 'o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YViBBQcGz7ug1mJmV_fo9YnB07iSY5RTDKFGRLaqzyXxoaBFAAAAAAAAAAAAAAAAAAAAAAAAAAAAIO0BRWmNVvKRnYGuOfahu97SYgEmbjy5-DFlCGAF3SpGpAEBAycgBiFYIAJTbgP8VkgRT0Y-nev2bh8aCoRpE03Jm1DzqFBtmmwy',
    getClientData: 'eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiYzJsbmJpMXBiaTFqYUdGc2JHVnVaMlV0Wm05eUxYUm9aUzEwWlhOMGN3Iiwib3JpZ2luIjoiaHR0cHM6Ly9ibG9nLmV4YW1wbGUiLCJjcm9zc09yaWdpbiI6ZmFsc2V9',
    authenticatorData: 'BQcGz7ug1mJmV_fo9YnB07iSY5RTDKFGRLaqzyXxoaAFAAAAAA',
    signature: '6UhxpPUnJiEzO1ajtGTAB238r6vSX6gSndhD5T1jyHDBef57xExoqQGI2D6RCb_WYpMrITP9x5Cehn-wuW1bCg',
    signCount: 0,
  },
  rs256: {
    credentialId: '7dsmfw0ZPJbnwxS8tEn9MXm3Hib0Hc-96sVnV462m8s',
    cose: 'pAEDAzkBACBZAQDlvoYoHKpuAbmW-OHJO-SSMcZ3Dt0lMCic48kH2b5ShhE30YXWzCXr-t-xLKNPPPp8nCK-wbSOcx_4fSN4AhPNmymNIDomuF_mKTdOcmGQ3ZRoq2R7mrZnhg9gLAAe-hwaDNYGfI3t3yhvUyaVJN8_C0uIhQcjkSwy4CTx3i3tiWX1SzRpWHlpTmDxWXqooqQU55CYQbE8RjkIph0MBVBrMzMGxvqGttkcx6LXL9h-a5WBmlD32iKPGm1t6mv0Rxtoe0Scy_L7Qgnc8l4iP3dikX68j2kStRxIbUMHZbcnBh52BNyOPSGjkrpsohHYrrbjN0UuChpRVatLAHkE5HZRIUMBAAE',
    attClientData: 'eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoiY21WbmFYTjBaWEl0WTJoaGJHeGxibWRsTFdadmNpMTBhR1V0ZEdWemRITSIsIm9yaWdpbiI6Imh0dHBzOi8vYmxvZy5leGFtcGxlIiwiY3Jvc3NPcmlnaW4iOmZhbHNlfQ',
    attestationObject: 'o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YVkBZwUHBs-7oNZiZlf36PWJwdO4kmOUUwyhRkS2qs8l8aGgRQAAAAAAAAAAAAAAAAAAAAAAAAAAACDt2yZ_DRk8lufDFLy0Sf0xebceJvQdz73qxWdXjraby6QBAwM5AQAgWQEA5b6GKByqbgG5lvjhyTvkkjHGdw7dJTAonOPJB9m-UoYRN9GF1swl6_rfsSyjTzz6fJwivsG0jnMf-H0jeAITzZspjSA6Jrhf5ik3TnJhkN2UaKtke5q2Z4YPYCwAHvocGgzWBnyN7d8ob1MmlSTfPwtLiIUHI5EsMuAk8d4t7Yll9Us0aVh5aU5g8Vl6qKKkFOeQmEGxPEY5CKYdDAVQazMzBsb6hrbZHMei1y_YfmuVgZpQ99oijxptbepr9EcbaHtEnMvy-0IJ3PJeIj93YpF-vI9pErUcSG1DB2W3JwYedgTcjj0ho5K6bKIR2K624zdFLgoaUVWrSwB5BOR2USFDAQAB',
    getClientData: 'eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiYzJsbmJpMXBiaTFqYUdGc2JHVnVaMlV0Wm05eUxYUm9aUzEwWlhOMGN3Iiwib3JpZ2luIjoiaHR0cHM6Ly9ibG9nLmV4YW1wbGUiLCJjcm9zc09yaWdpbiI6ZmFsc2V9',
    authenticatorData: 'BQcGz7ug1mJmV_fo9YnB07iSY5RTDKFGRLaqzyXxoaAFAAAAAw',
    signature: 'I131izbTwRfSBUiBASjxXkRpROw9IYklkbKgi3VKohd-l7XZY0pT5sEoZLxbCX0QSheZE6xQoKpyIDg2wwrode3uWDM3as5m9TTlouQHVfiKZx9DNUXo68mh1e4xO8CaXAtShXtRTZOgdFhr1x149zdVrV_CQF3QqG5uPwQkELe2WvVWPgdROmGsdaexYyNL5_Qt08UjQno9i4l6FIUQolWk86ppqDPEV9aSDUgSAWmUEg8EMDVECDlUckbKKvrM118nZn4EQJ_XctXA_BAHXiqu2Pmve3lJwoBMPLbPieZhCqZwcM-YwakIGR00avHGF1HNXVMex8-qOmInRzGggQ',
    signCount: 3,
  },
}
