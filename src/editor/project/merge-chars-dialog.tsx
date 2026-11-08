import { useMemo, useState } from 'react'
import {
  addMergedCharset,
  mergedCharsetName,
  planCharMerge,
  usedChars,
} from '@/c64/charset-merge'
import { CheckLine, Note, ReportSection } from '@/components/report'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CharsetSheet } from '../charset/charset-sheet'
import { hex } from '../hex'
import type { Charset } from '@/c64/charset'
import type { Project } from '@/c64/project'

const PITCH = 15
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * Merge chars into a new charset: a copy of another charset with chars from
 * this one added (all its used chars, or ones tapped in its sheet). Existing
 * charsets and maps don't change; switch maps to the new charset by hand.
 */
export function MergeCharsDialog({
  project,
  source,
  onOpenChange,
  onMerge,
}: {
  project: Project
  source: Charset
  onOpenChange: (open: boolean) => void
  /** Apply the merge to the project (one undo step). */
  onMerge: (change: (p: Project) => Project) => void
}) {
  const bases = project.charsets.filter((c) => c.id !== source.id)
  // Prefer a charset in the same mode: added chars keep their look there.
  const [baseId, setBaseId] = useState(
    (bases.find((c) => c.mode === source.mode) ?? bases.at(0))?.id ?? '',
  )
  const [selection, setSelection] = useState(() => new Set(usedChars(source)))
  const [name, setName] = useState<string | null>(null)

  const ordered = useMemo(
    () => [...selection].sort((a, b) => a - b),
    [selection],
  )
  const plan = useMemo(
    () => (baseId ? planCharMerge(project, source.id, baseId, ordered) : null),
    [project, source.id, baseId, ordered],
  )
  const newSlots = useMemo(
    () => new Set(plan?.moves.filter((m) => !m.reused).map((m) => m.to)),
    [plan],
  )

  const toggle = (i: number) =>
    setSelection((s) => {
      const next = new Set(s)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  if (!plan) {
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge chars from “{source.name}”</DialogTitle>
            <DialogDescription>
              Add another charset to the project to merge with.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )
  }

  const added = plan.moves.filter((m) => !m.reused)
  const reused = plan.moves.length - added.length
  const base = plan.target
  // The suggested name follows the chosen base until it's edited.
  const newName = name ?? mergedCharsetName(project, plan)
  const ok = !plan.error && added.length > 0 && newName.trim() !== ''

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Merge chars from “{source.name}”</DialogTitle>
          <DialogDescription>
            Makes a new charset: a copy of the one you merge with, plus the
            chars you choose here in its empty slots. Nothing else changes;
            switch maps to the new charset when you're ready.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 text-sm">
          <div className="flex flex-wrap gap-3">
            <Field label="Merge with" className="w-64">
              <Select value={baseId} onValueChange={setBaseId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="New charset name" className="min-w-64 flex-1">
              <Input
                value={newName}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-6">
            <ReportSection title={`From “${source.name}” · tap to choose`}>
              <CharsetSheet
                charset={source}
                selected={-1}
                marked={selection}
                pitch={PITCH}
                onPick={toggle}
              />
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelection(new Set(usedChars(source)))}
                >
                  All used chars
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelection(new Set())}
                >
                  None
                </Button>
                <span className="text-xs text-muted-foreground">
                  {plural(selection.size, 'char')} chosen
                </span>
              </div>
            </ReportSection>

            <ReportSection title="The new charset">
              <CharsetSheet
                charset={plan.merged}
                selected={-1}
                marked={newSlots}
                pitch={PITCH}
                onPick={() => {}}
              />
              <span className="max-w-[264px] text-xs text-muted-foreground">
                “{base.name}”'s chars stay where they are, so its maps work with
                the new charset. Outlined: the added chars.
              </span>
            </ReportSection>
          </div>

          <ReportSection title="Result">
            {plan.error ? (
              <CheckLine ok={false}>{plan.error}</CheckLine>
            ) : plan.moves.length === 0 ? (
              <CheckLine ok={false}>No chars chosen</CheckLine>
            ) : added.length === 0 ? (
              <CheckLine ok={false}>
                “{base.name}” already has all {plural(reused, 'chosen char')}
              </CheckLine>
            ) : (
              <CheckLine ok>
                {plural(added.length, 'char')} added
                {reused > 0 && `, ${reused} already in “${base.name}”`}.{' '}
                {plural(plan.free - added.length, 'free slot')} left.
              </CheckLine>
            )}
            {added.length > 0 && !plan.error && (
              <p className="font-mono text-xs text-muted-foreground">
                {added
                  .slice(0, 12)
                  .map((m) => `${hex(m.from)}→${hex(m.to)}`)
                  .join('  ')}
                {added.length > 12 && '  …'}
              </p>
            )}
            {plan.warnings.map((w) => (
              <Note key={w}>{w}</Note>
            ))}
            {plan.problems.length > 0 && (
              <Note>
                {plural(plan.problems.length, 'char')} won't look the same:{' '}
                {plan.problems
                  .slice(0, 4)
                  .map((issue) => `${hex(issue.char)} (${issue.problem})`)
                  .join('; ')}
                {plan.problems.length > 4 && '; …'}
              </Note>
            )}
          </ReportSection>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!ok}
            onClick={() => {
              onMerge((p) =>
                addMergedCharset(
                  p,
                  planCharMerge(p, source.id, baseId, ordered),
                  newName.trim(),
                ),
              )
              onOpenChange(false)
            }}
          >
            Create charset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
