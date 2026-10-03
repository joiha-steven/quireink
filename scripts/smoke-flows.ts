// The tour flows an INSTALL is checked with (ADR 0065): `SMOKE=1 bun scripts/tour.ts <url>`.
//
// Not the whole tour. The tour proves the code; this proves an install — that a release, put on a
// machine through one of the three packages, or upgraded there from the release before it, serves
// a reader, takes a post, stores a picture and writes a backup. Twelve flows, each one a thing an
// owner would notice within a day if it broke, and none that depends on a setting the seeder of
// an OLDER release might not have written.
//
// Names, exactly as the tour registers them. `tour.ts` refuses to run if one of these is missing,
// so renaming a flow cannot quietly shrink the smoke run.
export const SMOKE_FLOWS = [
  'home lists posts',
  'an article renders its body',
  'a reader can comment, and a script cannot',
  'the feed, sitemap, robots and llms all answer',
  'search answers as you type',
  'an OG image is drawn',
  'the analytics beacon is accepted',
  'admin: a draft saves and appears in the list',
  'admin: a published post is reachable publicly',
  'admin: a real image uploads and lists',
  'admin: the content search reaches into the body of a post',
  'admin: the backup archive builds',
] as const
