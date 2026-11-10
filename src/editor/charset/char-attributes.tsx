import { useEffect, useState } from 'react'
import { Eye, EyeOff, Tags } from 'lucide-react'
import {
  ATTRIBUTE_COUNT,
  MAX_ATTRIBUTE_NAME,
  charAttribute,
  charCount,
  setCharAttribute,
} from '@/c64/charset'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
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
          aria-label="Name the attributes"
          title="Name the attributes"
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
      <AttributeNamesDialog
        open={naming}
        onOpenChange={setNaming}
        charset={charset}
        onSave={(names) =>
          onChange((cs) => ({
            ...cs,
            attributeNames: names.map((n, v) =>
              v === 0 ? '' : n.trim().slice(0, MAX_ATTRIBUTE_NAME),
            ),
          }))
        }
      />
    </div>
  )
}

/** Name attributes 1-15 for this charset (one undo step). */
function AttributeNamesDialog({
  open,
  onOpenChange,
  charset,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  charset: Charset
  onSave: (names: Array<string>) => void
}) {
  const [names, setNames] = useState<Array<string>>(() => [
    ...charset.attributeNames,
  ])
  useEffect(() => {
    if (open) setNames([...charset.attributeNames])
  }, [open, charset.attributeNames])
  const used = (v: number) =>
    charset.attributes
      .subarray(0, charCount(charset.mode))
      .reduce((n, a) => n + (a === v ? 1 : 0), 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            onSave(names)
            onOpenChange(false)
          }}
        >
          <DialogHeader>
            <DialogTitle>Attribute names · {charset.name}</DialogTitle>
            <DialogDescription>
              Names are for you; exports carry the numbers (and the names as
              comments in KickAss source).
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {VALUES.slice(1).map((v) => (
              <label key={v} className="flex items-center gap-2">
                <AttributeSwatch value={v} />
                <Input
                  value={names[v] ?? ''}
                  maxLength={MAX_ATTRIBUTE_NAME}
                  placeholder={`Attribute ${digit(v)}`}
                  aria-label={`Name of attribute ${v}`}
                  onChange={(e) => {
                    const next = [...names]
                    next[v] = e.target.value
                    setNames(next)
                  }}
                  className="h-8"
                />
                <span
                  className="w-7 shrink-0 text-right font-mono text-[11px] text-muted-foreground"
                  title={`Chars with attribute ${v}`}
                >
                  {used(v) || ''}
                </span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
