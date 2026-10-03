// `import workflow from './update-quireink.yml' with { type: 'text' }` is a Bun feature, as for
// `*.sql` beside this: TypeScript has to be told the import yields a string. The one such file is the
// workflow a button blog's owner commits into their copy (`install/cloudflare/update-workflow.ts`).
declare module '*.yml' {
  const content: string
  export default content
}
