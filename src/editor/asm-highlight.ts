/** Kinds of KickAssembler token, each with its own colour. */
export type AsmTokenKind =
  'comment' | 'directive' | 'mnemonic' | 'number' | 'string' | 'label' | 'plain'

export interface AsmToken {
  kind: AsmTokenKind
  text: string
}

const MNEMONICS = new Set(
  (
    'adc and asl bcc bcs beq bit bmi bne bpl brk bvc bvs clc cld cli clv cmp ' +
    'cpx cpy dec dex dey eor inc inx iny jmp jsr lda ldx ldy lsr nop ora pha ' +
    'php pla plp rol ror rti rts sbc sec sed sei sta stx sty tax tay tsx txa ' +
    'txs tya'
  ).split(' '),
)

const RULES: ReadonlyArray<[RegExp, AsmTokenKind | 'word']> = [
  [/^"(?:[^"\\]|\\.)*"?/, 'string'],
  [/^\.[a-z]+(?: binary\b)?/i, 'directive'],
  [/^#?(?:\$[0-9a-f]+|%[01]+|\d+)|^#/i, 'number'],
  [/^[a-z_][a-z0-9_]*:/i, 'label'],
  [/^[a-z_][a-z0-9_]*/i, 'word'],
  [/^\s+/, 'plain'],
  [/^./, 'plain'],
]

function code(text: string, out: Array<AsmToken>) {
  let rest = text
  while (rest) {
    if (rest.startsWith('//')) {
      comments(rest, out)
      return
    }
    for (const [re, kind] of RULES) {
      const m = re.exec(rest)
      if (!m) continue
      const t = m[0]
      push(
        out,
        kind === 'word'
          ? MNEMONICS.has(t.toLowerCase())
            ? 'mnemonic'
            : 'plain'
          : kind,
        t,
      )
      rest = rest.slice(t.length)
      break
    }
  }
}

/**
 * A `//` comment. One with four or more spaces after the slashes is example
 * code (`//     lda $d018`), so its code is coloured too.
 */
function comments(text: string, out: Array<AsmToken>) {
  const example = /^\/\/( {4,})(\S.*)$/.exec(text)
  if (!example) {
    push(out, 'comment', text)
    return
  }
  push(out, 'comment', `//${example[1]}`)
  code(example[2], out)
}

function push(out: Array<AsmToken>, kind: AsmTokenKind, text: string) {
  const last = out.at(-1)
  if (last && last.kind === kind) last.text += text
  else out.push({ kind, text })
}

/** One line of KickAssembler source as coloured tokens. */
export function highlightAsmLine(line: string): Array<AsmToken> {
  const out: Array<AsmToken> = []
  code(line, out)
  return out
}
