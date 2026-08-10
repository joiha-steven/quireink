// Generates `dtsPropsFor` — the props body for every component's emitted <Name>.d.ts.
//
// WHY THIS EXISTS. The converter reads prop contracts out of a package's SHIPPED .d.ts
// tree. Quire Ink ships none: it is an application, its types never leave the repo, and the
// extractor consequently emitted `[key: string]: unknown` for all 130 components. That is
// not a cosmetic loss — the .d.ts IS the API the claude.ai/design agent codes against, so a
// blank one means the agent knows Button exists and nothing about `variant`.
//
// So the types are read from source instead, with the admin's own tsconfig (its `paths` and
// `jsx` settings are what make `@/…` and JSX resolve). Only props DECLARED IN THIS REPO are
// listed: React's HTML attribute interfaces contribute ~250 inherited members each, which
// would bury the four props that actually carry the design language. Inherited sets are
// summarised as a trailing comment instead.
//
// Run: node .design-sync/gen-props.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Project, Node, ts } from '../.ds-sync/node_modules/ts-morph/dist/ts-morph.js'

const ROOT = resolve(import.meta.dirname, '..')
const cfgPath = join(ROOT, '.design-sync/config.json')
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'))

const project = new Project({
  tsConfigFilePath: join(ROOT, 'src/admin/tsconfig.json'),
  skipAddingFilesFromTsConfig: true,
})

/** The function node behind an exported component, however it was declared. */
function componentFn(sf, name) {
  for (const [exportedAs, decls] of sf.getExportedDeclarations()) {
    const real = exportedAs === 'default'
      ? decls.map((d) => d.getName?.()).find((n) => n && n !== 'default')
      : exportedAs
    if (real !== name) continue
    for (const d of decls) {
      if (Node.isFunctionDeclaration(d)) return d
      if (Node.isVariableDeclaration(d)) {
        const init = d.getInitializer()
        if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) return init
        // forwardRef(...) / memo(...) — the inner function is the first argument.
        if (init && Node.isCallExpression(init)) {
          const a = init.getArguments()[0]
          if (a && (Node.isArrowFunction(a) || Node.isFunctionExpression(a))) return a
        }
      }
    }
  }
  return null
}

const clean = (s) => s.replace(/import\("[^"]*"\)\./g, '').replace(/\s+/g, ' ').trim()

function propsBody(file, name) {
  const sf = project.addSourceFileAtPath(file)
  const fn = componentFn(sf, name)
  if (!fn) return null
  const param = fn.getParameters()[0]
  if (!param) return '' // takes no props
  const type = param.getType()
  // Not `isObject()`: the primitives declare props as `ButtonHTMLAttributes<…> & {variant}`,
  // and an intersection is not an object type — that check dropped exactly the components
  // whose contracts matter most. `getProperties()` flattens intersections on its own.
  if (!type.getProperties().length) return ''

  const own = []
  const inherited = new Set()
  for (const sym of type.getProperties()) {
    const decl = sym.getDeclarations()[0]
    if (!decl) continue
    const from = decl.getSourceFile().getFilePath()
    // A prop declared under node_modules is inherited React/library surface.
    if (from.includes('node_modules')) {
      const m = /node_modules\/(@types\/)?([^/]+)/.exec(from)
      inherited.add(m ? m[2] : 'library')
      continue
    }
    const pt = sym.getTypeAtLocation(param)
    // Expand a union to its members rather than printing the alias name. `variant?: Variant`
    // tells the design agent nothing; `variant?: 'primary' | 'secondary' | 'ghost' | 'danger'`
    // is the whole design language of the component. `undefined` is dropped because the `?`
    // already says it.
    // Only a union of LITERALS is worth expanding. `ReactNode` is also a union, and
    // expanding it yields a 300-character wall that gets truncated to `unknown` — strictly
    // worse than the name `ReactNode`, which the design agent already understands.
    const members = pt.isUnion() ? pt.getUnionTypes().filter((u) => !u.isUndefined()) : []
    const allLiterals = members.length > 0 && members.every((u) => u.isLiteral() || u.isBooleanLiteral())
    let text = allLiterals
      ? [...new Set(members.map((u) => clean(u.getText(param, ts.TypeFormatFlags.NoTruncation))))]
        .join(' | ').replace(/\bfalse \| true\b/, 'boolean')
      : clean(pt.getText(param, ts.TypeFormatFlags.NoTruncation)).replace(/ \| undefined$/, '')
    if (!text || text.length > 200) text = 'unknown'
    const optional = decl.getQuestionTokenNode?.() != null
      || sym.getDeclarations().some((d) => d.getQuestionTokenNode?.() != null)
    const doc = decl.getJsDocs?.()?.[0]?.getCommentText?.()
    const line = `${optional ? `${sym.getName()}?` : sym.getName()}: ${text};`
    own.push(doc ? `/** ${clean(doc).slice(0, 160)} */\n  ${line}` : line)
  }
  if (!own.length && !inherited.size) return ''
  const note = inherited.size
    ? `\n  /* plus the standard props inherited from ${[...inherited].sort().join(', ')} */\n  [key: string]: unknown;`
    : ''
  return own.join('\n  ') + note
}

const out = {}
let ok = 0, blank = 0, failed = []
for (const [name, rel] of Object.entries(cfg.componentSrcMap ?? {})) {
  if (!rel) continue
  let body = null
  try { body = propsBody(join(ROOT, rel), name) } catch (e) { failed.push(`${name}: ${e.message.split('\n')[0]}`) }
  if (body === null) { failed.push(name); continue }
  if (body === '') { blank++; continue } // no props — let the converter emit its own empty shape
  out[name] = body
  ok++
}

cfg.dtsPropsFor = out
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n')
console.log(`dtsPropsFor: ${ok} with props, ${blank} propless, ${failed.length} unresolved`)
if (failed.length) console.log('unresolved:', failed.slice(0, 20).join(', '))
