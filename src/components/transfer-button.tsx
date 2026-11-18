import { useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface TransferOption {
  icon: LucideIcon
  label: string
  description: string
  /** Runs in the tap, after the modal closes (file pickers need the tap). */
  onSelect: () => void
}

/**
 * "Transfer": one header button for moving things in and out (cloud,
 * import, export), so the header stays uncluttered.
 */
export function TransferButton({
  description,
  options,
}: {
  description: string
  options: ReadonlyArray<TransferOption>
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <ArrowLeftRight aria-hidden="true" />
        Transfer
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {options.map(
              ({ icon: Icon, label, description: about, onSelect }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    onSelect()
                  }}
                  className="flex items-center gap-3 rounded-lg border border-rule px-3 py-2.5 text-left hover:border-primary focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <Icon aria-hidden="true" className="size-5 shrink-0" />
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{label}</span>
                    <span className="text-xs text-muted-foreground">
                      {about}
                    </span>
                  </span>
                </button>
              ),
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
