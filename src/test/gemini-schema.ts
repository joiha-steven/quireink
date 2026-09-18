// WHAT GEMINI WILL TAKE, as a list two doors are both held to.
//
// Issue #66: `update_settings.value` is `string | number | boolean`. zod 4.4 wrote that as an
// `anyOf` of one-type schemas; zod 4.6 writes it as `type: ['string','number','boolean']`. Both
// are valid JSON Schema and the second is a 400 from Google on every request, because its
// `type` is a single-valued enum. Nothing here changed, a dependency did, and the only judge
// of that payload lives at Google — so the shape shipped broken for two releases.
//
// This is the judge, brought in-house. It is deliberately a list of FIELD NAMES as well as of
// shapes: the thing that escaped was not a rule anybody here broke, it was a field nobody here
// wrote. A guard that only checked the rewrites we know about would have passed it too.
//
// Source: https://ai.google.dev/api/caching#Schema

/** Every field Gemini's Schema reads, and no more. */
const FIELDS = new Set([
  'type', 'format', 'title', 'description', 'nullable', 'default',
  'items', 'minItems', 'maxItems', 'enum', 'properties', 'required',
  'minProperties', 'maxProperties', 'minimum', 'maximum', 'minLength',
  'maxLength', 'pattern', 'example', 'anyOf', 'propertyOrdering',
])

/** Its `Type` enum. No `null`: a nullable member is the `nullable` flag instead. */
const TYPES = new Set(['string', 'number', 'integer', 'boolean', 'array', 'object'])

/**
 * Every complaint, with the path that earned it — a list rather than a throw, so one run names
 * all of them and a failure reads as a report instead of a first casualty.
 */
export function refusals(schema: Record<string, unknown>, where: string): string[] {
  const out: string[] = []
  for (const [key, value] of Object.entries(schema)) {
    if (!FIELDS.has(key)) { out.push(`${where}: no such field "${key}"`); continue }
    if (key === 'type' && !TYPES.has(String(value))) out.push(`${where}.type = ${JSON.stringify(value)}`)
    // `enum` is strings only there; a numeric union has to travel as a description.
    if (key === 'enum' && !(value as unknown[]).every((v) => typeof v === 'string')) {
      out.push(`${where}.enum = ${JSON.stringify(value)}`)
    }
    if (key === 'items') out.push(...refusals(value as Record<string, unknown>, `${where}.items`))
    if (key === 'anyOf') {
      (value as Record<string, unknown>[]).forEach((m, i) => out.push(...refusals(m, `${where}.anyOf[${i}]`)))
    }
    if (key === 'properties') {
      for (const [name, sub] of Object.entries(value as Record<string, Record<string, unknown>>)) {
        out.push(...refusals(sub, `${where}.${name}`))
      }
    }
  }
  return out
}
