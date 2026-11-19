import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { AsmCode } from './asm-code'
import { Button } from '@/components/ui/button'

/** "Show KickAss code to import the .bin": code to copy into your source. */
export function ImportCode({ code }: { code: () => string }) {
  const [on, setOn] = useState(false)
  const [copied, setCopied] = useState(false)
  const text = on ? code() : ''
  return (
    <>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
        />
        Show KickAss code to import the .bin
      </label>
      {on && (
        <div className="relative">
          <AsmCode text={text} className="pr-24" />
          <Button
            size="sm"
            variant="outline"
            className="absolute top-2 right-2"
            onClick={() => {
              void navigator.clipboard.writeText(text).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              })
            }}
          >
            {copied ? (
              <Check aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      )}
    </>
  )
}
