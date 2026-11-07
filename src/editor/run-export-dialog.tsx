import { useState } from 'react'
import { Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Segmented } from './segmented'
import type { ReactNode } from 'react'

type Tab = 'run' | 'export'

/** The tab used last, kept while the app runs (shared by every worksheet). */
let lastTab: Tab = 'run'

/**
 * "Run & export": run the asset on the built-in C64, or export it as files.
 * The export tab's content (formats, options, Save) comes from the worksheet.
 */
export function RunExportDialog({
  title,
  runSummary,
  onRun,
  exportPanel,
  onClose,
}: {
  title: string
  /** What Run will show, in a sentence or two. */
  runSummary: ReactNode
  onRun: () => void
  exportPanel: ReactNode
  onClose: () => void
}) {
  const [tab, setTabState] = useState<Tab>(lastTab)
  const setTab = (t: Tab) => {
    lastTab = t
    setTabState(t)
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-[640px] sm:max-w-[640px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Run & export · {title}</DialogTitle>
          <DialogDescription className="sr-only">
            Run on the built-in C64, or export as files.
          </DialogDescription>
        </DialogHeader>
        <Segmented
          label="Run or export"
          value={tab}
          options={[
            { value: 'run', label: 'Run on C64' },
            { value: 'export', label: 'Export files' },
          ]}
          onChange={setTab}
        />
        {tab === 'run' ? (
          <>
            <div className="flex flex-col gap-2 text-sm">
              <div>{runSummary}</div>
              <p className="text-muted-foreground">
                Runs in c64-ready, the C64 emulator built into C64-Pad. From
                there you can save the .prg to load in VICE or on real hardware.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  onClose()
                  onRun()
                }}
              >
                <Play aria-hidden="true" /> Run
              </Button>
            </DialogFooter>
          </>
        ) : (
          exportPanel
        )}
      </DialogContent>
    </Dialog>
  )
}
