// Copy c64-ready's runtime files (emulator wasm + audio worklet) into
// public/c64/ so Vite serves them in dev and bundles them into the build
// (and so into the Android app, which must work offline).
import { copyFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const source = dirname(require.resolve('c64-ready/wasm'))
const target = join(import.meta.dirname, '..', 'public', 'c64')
mkdirSync(target, { recursive: true })
for (const file of ['c64.wasm', 'audio-worklet-processor.js']) {
  copyFileSync(join(source, file), join(target, file))
}
console.log(`c64-ready assets copied to ${target}`)
