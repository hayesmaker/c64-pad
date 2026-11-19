import { useMemo } from 'react'
import { highlightAsmLine } from './asm-highlight'
import type { AsmTokenKind } from './asm-highlight'
import { cn } from '@/lib/utils'

const COLOUR: Record<AsmTokenKind, string | undefined> = {
  comment: 'text-code-comment',
  directive: 'text-code-directive',
  mnemonic: 'text-code-mnemonic',
  number: 'text-code-number',
  string: 'text-code-string',
  label: 'text-code-label',
  plain: undefined,
}

/** KickAssembler source, syntax coloured; long sources end in "…". */
export function AsmCode({
  text,
  maxLines,
  className,
}: {
  text: string
  maxLines?: number
  className?: string
}) {
  const lines = useMemo(() => {
    const all = text.split('\n')
    return maxLines && all.length > maxLines
      ? [...all.slice(0, maxLines), '…']
      : all
  }, [text, maxLines])
  return (
    <pre
      className={cn(
        'max-h-48 overflow-auto rounded-lg border border-rule-soft bg-muted p-3 font-mono text-[11px] leading-snug select-text',
        className,
      )}
    >
      {lines.map((line, i) => (
        <span key={i}>
          {highlightAsmLine(line).map((t, j) => (
            <span key={j} className={COLOUR[t.kind]}>
              {t.text}
            </span>
          ))}
          {i < lines.length - 1 ? '\n' : ''}
        </span>
      ))}
    </pre>
  )
}
