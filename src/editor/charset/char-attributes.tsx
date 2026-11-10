import { useState } from 'react'
import { Eye, EyeOff, Tags } from 'lucide-react'
import {
  ATTRIBUTE_COUNT,
  MAX_ATTRIBUTE_NAME,
  charAttribute,
  setAttributeName,
  setCharAttribute,
} from '@/c64/charset'
import { PromptDialog } from '@/components/dialogs'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { attributeTint } from '../attribute-overlay'
import { hex } from '../hex'
import type { Charset } from '@/c64/charset'

const VALUES = Array.from({ length: ATTRIBUTE_COUNT }, (_, v) => v)
const digit = (v: number) => v.toString(16).toUpperCase()

/** The attribute's overlay colour and hex digit, as on the sheet. */
export function AttributeSwatch({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-5 shrink-0 items-center justify-center rounded-[4px] border border-rule font-mono text-[11px] font-bold',
        value === 0 && 'text-muted-foreground',
        className,
      )}
      style={
        value === 0
          ? undefined
          : { background: attributeTint(value), color: '#000' }
      }
    >
      {digit(value)}
    </span>
  )
}

/**
 * The selected char's attribute (0-15, CharPad's "material"), naming the
 * values, and showing them over the sheet.
 */
export function CharAttributeControls({
  charset,
  selected,
  show,
  onShow,
  onChange,
}: {
  charset: Charset
  selected: number
  show: boolean
  onShow: (show: boolean) => void
  /** Change the charset (an undoable step). */
  onChange: (fn: (cs: Charset) => Charset) => void
}) {
  const [naming, setNaming] = useState(false)
  const value = charAttribute(charset, selected)
  return (
    <div className="flex flex-col gap-[3px]">
      <span className="text-xs text-muted-foreground">
        Attribute of {hex(selected)} · for game code (0 = none)
      </span>
      <div className="flex gap-1.5">
        <Select
          value={String(value)}
          onValueChange={(v) =>
            onChange((cs) => setCharAttribute(cs, selected, Number(v)))
          }
        >
          <SelectTrigger
            className="min-w-0 flex-1"
            aria-label={`Attribute of character ${selected}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VALUES.map((v) => (
              <SelectItem key={v} value={String(v)}>
                <AttributeSwatch value={v} />
                {v > 0 && <span className="sr-only">{digit(v)}:</span>}
                {v === 0
                  ? 'None'
                  : charset.attributeNames[v] || (
                      <span className="text-muted-foreground">Unnamed</span>
                    )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          disabled={value === 0}
          aria-label={
            value === 0
              ? 'Name this attribute (pick one first)'
              : `Name attribute ${digit(value)}`
          }
          title={
            value === 0
              ? 'Pick an attribute to name it'
              : `Name attribute ${digit(value)}`
          }
          onClick={() => setNaming(true)}
        >
          <Tags aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-pressed={show}
          aria-label="Show attributes on the characters"
          title={show ? 'Hide attributes' : 'Show attributes'}
          className={cn(
            show && 'border-primary bg-accent text-primary hover:bg-accent',
          )}
          onClick={() => onShow(!show)}
        >
          {show ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
        </Button>
      </div>
      <PromptDialog
        open={naming}
        onOpenChange={setNaming}
        title={`Name attribute ${digit(value)}`}
        label="Name (empty to clear)"
        placeholder={`Attribute ${digit(value)}`}
        maxLength={MAX_ATTRIBUTE_NAME}
        allowEmpty
        initialValue={charset.attributeNames[value] ?? ''}
        onSubmit={(name) => onChange((cs) => setAttributeName(cs, value, name))}
      />
    </div>
  )
}
