// Regenerate src/c64/rom/chargen.gen.ts from c64-ready's emulator: assemble
// scripts/copy-chargen.asm, run it headless and read the copied ROM back.
//
// Needs KickAssembler (KICKASS_JAR, default /opt/KickAss.jar) and the dev
// server serving c64.wasm: node scripts/extract-chargen.mjs [wasm url]
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { C64Emulator } from 'c64-ready/dist-ts/emulator/c64-emulator.js'

const wasmUrl = process.argv[2] ?? 'http://localhost:3000/c64/c64.wasm'
const jar = process.env.KICKASS_JAR ?? '/opt/KickAss.jar'
const dir = mkdtempSync(join(tmpdir(), 'chargen-'))
const prgPath = join(dir, 'copy.prg')
execFileSync('java', ['-jar', jar, 'scripts/copy-chargen.asm', '-o', prgPath])

const emu = await C64Emulator.load(wasmUrl)
emu.start()
const run = (seconds) => {
  for (let i = 0; i < seconds * 50; i++) emu.tick(20)
}
run(3) // boot to READY.
emu.loadGame({ type: 'prg', data: new Uint8Array(readFileSync(prgPath)) })
run(0.5)
// Type RUN<return> into the keyboard buffer.
;[0x52, 0x55, 0x4e, 0x0d].forEach((c, i) => emu.ramWrite(0x0277 + i, c))
emu.ramWrite(0xc6, 4)
run(2)
if (emu.ramRead(0x3fff) !== 1)
  throw new Error('The copy program did not finish')

const rom = new Uint8Array(4096)
for (let i = 0; i < rom.length; i++) rom[i] = emu.ramRead(0x4000 + i)
const md5 = createHash('md5').update(rom).digest('hex')
if (md5 !== '12a4202f5331d45af846af6c58fba946') {
  throw new Error(`Unexpected ROM (md5 ${md5})`)
}
const b64 = Buffer.from(rom).toString('base64')
const lines = b64.match(/.{1,76}/g).map((l) => `  '${l}'`)
writeFileSync(
  'src/c64/rom/chargen.gen.ts',
  `/**
 * The C64 character generator ROM (901225-01, 4096 bytes): the upper case /
 * graphics set, then the lower / upper case set.
 *
 * Commodore copyright, now held by Cloanto; bundled, as most C64 tools do,
 * for the optional PETSCII starter charset. Kept in its own file so it can be
 * swapped or dropped. Extracted from c64-ready's emulator by
 * scripts/extract-chargen.mjs (md5 ${md5}).
 */
export const chargenRom =
${lines.join(' +\n')}
`,
)
console.log('Wrote src/c64/rom/chargen.gen.ts')
