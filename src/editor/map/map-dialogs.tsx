import { useState } from 'react'
import { MAX_MAP_SIZE, decodeEcm, encodeEcm } from '@/c64/charmap'
import { Field } from '@/components/worksheet/field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CharsetSheet } from '../charset/charset-sheet'
import { CharIcon } from './map-brush'
import { hex } from '../hex'
import { ScreenPresets } from './map-size'
import type { Charmap } from '@/c64/charmap'
import type { Charset } from '@/c64/charset'

export function ResizeDialog({
  map,
  onClose,
  onResize,
}: {
  map: Charmap
  onClose: () => void
  onResize: (width: number, height: number) => void
}) {
  const [width, setWidth] = useState(String(map.width))
  const [height, setHeight] = useState(String(map.height))
  const w = Number(width)
  const h = Number(height)
  const ok = [w, h].every(
    (n) => Number.isInteger(n) && n >= 1 && n <= MAX_MAP_SIZE,
  )
  const shrinks = ok && (w < map.width || h < map.height)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!ok) return
            onResize(w, h)
            onClose()
          }}
        >
          <DialogHeader>
            <DialogTitle>Resize map</DialogTitle>
            <DialogDescription>
              Make the map bigger than one screen to draw scrolling levels.
              Content stays at the top left; new cells get the Blank Char (
              {hex(map.blank)}). Up to {MAX_MAP_SIZE}×{MAX_MAP_SIZE} chars.
            </DialogDescription>
          </DialogHeader>
          <ScreenPresets
            width={Number(width)}
            height={Number(height)}
            onPick={(pw, ph) => {
              setWidth(String(pw))
              setHeight(String(ph))
            }}
          />
          <div className="flex gap-3">
            <Field label="Width (chars)" className="flex-1">
              <Input
                inputMode="numeric"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
              />
            </Field>
            <Field label="Height (chars)" className="flex-1">
              <Input
                inputMode="numeric"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </Field>
          </div>
          {!ok && (
            <p className="text-sm text-destructive">
              Width and height must be 1–{MAX_MAP_SIZE}.
            </p>
          )}
          {shrinks && (
            <p className="text-sm text-muted-foreground">
              Cells outside the new size are cut off (you can undo this).
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ok}>
              Resize
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Choose the map's Blank Char: what new cells get and what Erase writes. */
export function BlankCharDialog({
  charset,
  blank,
  onClose,
  onSave,
}: {
  charset: Charset
  blank: number
  onClose: () => void
  onSave: (code: number) => void
}) {
  const ecm = charset.mode === 'ecm'
  const [code, setCode] = useState(blank)
  const char = ecm ? decodeEcm(code).char : code
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-[440px] sm:max-w-[440px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Blank Char</DialogTitle>
          <DialogDescription>
            The character that means “empty” on this map: Erase writes it, and
            new cells get it when the map grows. Usually $00 for custom maps, or
            $20 in PETSCII.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-4">
          <CharsetSheet
            charset={charset}
            selected={char}
            pitch={15}
            onPick={(i) =>
              setCode(ecm ? encodeEcm(i, decodeEcm(code).background) : i)
            }
          />
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Blank Char</span>
            <CharIcon charset={charset} code={code} className="size-16" />
            <span className="font-mono text-sm">{hex(code)}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {code}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            className="mr-auto"
            disabled={code === 0}
            onClick={() => setCode(0)}
          >
            Reset to $00
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave(code)
              onClose()
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
