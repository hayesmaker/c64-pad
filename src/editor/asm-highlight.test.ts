import { describe, expect, it } from 'vitest'
import { highlightAsmLine } from './asm-highlight'

const kinds = (line: string) =>
  highlightAsmLine(line)
    .filter((t) => t.text.trim())
    .map((t) => [t.kind, t.text.trim()])

describe('KickAssembler highlighting', () => {
  it('colours directives, labels, numbers and comments', () => {
    expect(kinds('.label ships_mc1 = 11 // Dark Grey ($d025)')).toEqual([
      ['directive', '.label'],
      ['plain', 'ships_mc1 ='],
      ['number', '11'],
      ['comment', '// Dark Grey ($d025)'],
    ])
    expect(kinds('ships_0:')).toEqual([['label', 'ships_0:']])
    expect(kinds('    .byte $80, $00, %0101')).toEqual([
      ['directive', '.byte'],
      ['number', '$80'],
      ['plain', ','],
      ['number', '$00'],
      ['plain', ','],
      ['number', '%0101'],
    ])
  })

  it('keeps .import binary and its file name together', () => {
    expect(kinds('    .import binary "P-Level 1-chars.bin"')).toEqual([
      ['directive', '.import binary'],
      ['string', '"P-Level 1-chars.bin"'],
    ])
  })

  it('colours the code in commented examples', () => {
    expect(kinds('//     lda #(ships_0 & $3fff) / 64')).toEqual([
      ['comment', '//'],
      ['mnemonic', 'lda'],
      ['number', '#'],
      ['plain', '(ships_0 &'],
      ['number', '$3fff'],
      ['plain', ') /'],
      ['number', '64'],
    ])
    // Prose comments stay comments.
    expect(kinds('// Point the VIC at it (lda)')).toEqual([
      ['comment', '// Point the VIC at it (lda)'],
    ])
  })

  it('keeps every character', () => {
    const line = '  .byte $00, $00, $03  // ......................33'
    expect(
      highlightAsmLine(line)
        .map((t) => t.text)
        .join(''),
    ).toBe(line)
  })
})
