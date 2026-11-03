import { describe, expect, it } from 'bun:test'
import { faultsIn } from './local-instances'

describe('check:local-instances', () => {
  it('fails a TypeScript spawn of the server that does not go through localEnv()', () => {
    expect(faultsIn('scripts/x.ts', `Bun.spawn(['bun', 'src/index.ts'], { env: { ...process.env, PORT: '1' } })`)).toHaveLength(1)
    expect(faultsIn('scripts/x.ts', `Bun.spawn(['bun', 'src/index.ts'], { env: { ...localEnv(), PORT: '1' } })`)).toEqual([])
    // A comment naming the file is not a spawn.
    expect(faultsIn('scripts/x.ts', `// then bun 'src/index.ts' starts`)).toEqual([])
  })

  it('fails a wrangler dev that does not pass the variable', () => {
    expect(faultsIn('scripts/x.ts', `spawn(join(ROOT, 'wrangler'), ['dev', '--local'])`)).toHaveLength(1)
    expect(faultsIn('scripts/x.ts', "spawn(join(ROOT, 'wrangler'), ['dev', '--var', `UPDATE_CHECK:${updateCheck()}`])")).toEqual([])
  })

  it('fails a shell command that starts a blog without the default, across continuation lines', () => {
    expect(faultsIn('scripts/x.sh', 'DATA_DIR=d PORT=1 bun src/index.ts &\n')).toHaveLength(1)
    expect(faultsIn('scripts/x.sh', 'DATA_DIR=d UPDATE_CHECK="${UPDATE_CHECK:-0}" \\\n  bun src/index.ts &\n')).toEqual([])
    // A hard-coded 0 overrides a caller who set the variable on purpose.
    expect(faultsIn('scripts/x.sh', 'UPDATE_CHECK=0 bun src/index.ts &\n')).toHaveLength(1)
    expect(faultsIn('scripts/x.sh', 'docker run -d -p 1:3000 quireink\n')).toHaveLength(1)
    expect(faultsIn('scripts/x.sh', '# bun src/index.ts\n')).toEqual([])
  })

  it('fails a file that runs server.sh on an image without the variable baked in', () => {
    expect(faultsIn('scripts/x.sh', 'sudo bash next/server.sh --version 1\n')).toHaveLength(1)
    expect(faultsIn('scripts/x.sh', "printf 'FROM a\\nENV UPDATE_CHECK=0\\n' | docker build -\nsudo bash next/server.sh\n")).toEqual([])
  })
})
