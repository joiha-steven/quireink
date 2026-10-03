// Cloudflare: the off-site copy (ADR 0035) is not built yet (G4). The blog's own copies already
// live in R2 with 30 days of point-in-time history behind the Durable Object; a second bucket
// elsewhere needs a signed S3 client that runs in a Worker. Until then every call refuses with a
// reason — at the CALL, not here: `replicateSnapshot` builds the client outside its `try`, and a
// throw there would fail the backup it is only meant to copy. Refused per call, it is logged as
// any bucket that will not answer, and the settings screen's test shows the sentence.
import type { OffsitePort } from '@/runtime/ports'

const refuse = (): Promise<never> => Promise.reject(new Error('the off-site copy does not run on Cloudflare yet (G4)'))

export const s3Client: OffsitePort['s3Client'] = () => ({ write: refuse, list: refuse, delete: refuse })

void ({ s3Client } satisfies OffsitePort)
