import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Download, Redo2, Undo2 } from 'lucide-react'
import {
  addAsset,
  duplicateAsset,
  mapsUsingCharset,
  removeCharset,
  removeMap,
  removeSpriteSet,
  renameAsset,
} from '@/c64/project'
import { createSpriteSet } from '@/c64/sprite-set'
import { createCharset, petsciiData } from '@/c64/charset'
import { createCharmap } from '@/c64/charmap'
import { COLOR_NAMES } from '@/c64/palette'
import { WorksheetLayout } from '@/components/worksheet/worksheet-layout'
import { Breadcrumbs } from '@/components/worksheet/breadcrumbs'
import { ConfirmDialog, PromptDialog } from '@/components/dialogs'
import { SaveStatus } from '@/components/save-status'
import {
  CharsetThumbnail,
  MapThumbnail,
  SpriteSetThumbnail,
} from '@/components/c64/thumbnails'
import { Button } from '@/components/ui/button'
import { AssetCard, AssetMenu, AssetSection } from '@/editor/project/asset-list'
import {
  DeleteCharsetDialog,
  NewCharsetDialog,
  NewMapDialog,
  nextName,
} from '@/editor/project/asset-dialogs'
import { ProjectFields } from '@/editor/project/project-fields'
import { useProjectHistory } from '@/editor/project-history'
import { ToolButton, useUndoShortcuts } from '@/editor/grid-parts'
import { ImportAsepriteButton } from '@/import/aseprite/import-aseprite-button'
import { useCurrentProject } from '@/storage/use-current-project'
import {
  PROJECT_FILE_EXTENSION,
  exportProjectFile,
} from '@/storage/project-file'
import { safeFileName, saveTextFile } from '@/platform/save-file'
import type { AssetKind, Project } from '@/c64/project'
import type { Charset, CharsetMode } from '@/c64/charset'

export const Route = createFileRoute('/projects/$projectId/')({
  component: ProjectPage,
})

const MODE_LABEL: Record<CharsetMode, string> = {
  hires: 'Hires',
  multicolor: 'Multicolour',
  ecm: 'ECM',
}

type AssetRef = { kind: AssetKind; id: string; name: string }
type DialogState =
  | { kind: 'rename'; asset: AssetRef }
  | { kind: 'delete'; asset: AssetRef }
  | { kind: 'deleteCharset'; charset: Charset }
  | { kind: 'newMap' }
  | { kind: 'newCharset' }
  | null

/** The Project Worksheet: the project's fields and all its assets. */
function ProjectPage() {
  const { session, project, status, error } = useCurrentProject()
  const [dialog, setDialog] = useState<DialogState>(null)
  const history = useProjectHistory(session, project)
  useUndoShortcuts(history)
  /** Every change here is one undo step. */
  const update = (fn: (p: Project) => Project) => history.change(fn)
  const projectId = project.id
  const close = (open: boolean) => !open && setDialog(null)

  const exportFile = async () => {
    await session.flush()
    await saveTextFile(
      safeFileName(project.name) + PROJECT_FILE_EXTENSION,
      exportProjectFile(session.getSnapshot().project),
    )
  }

  const menuFor = (asset: AssetRef, onDelete?: () => void) => (
    <AssetMenu
      name={asset.name}
      onRename={() => setDialog({ kind: 'rename', asset })}
      onDuplicate={() => update((p) => duplicateAsset(p, asset.kind, asset.id))}
      onDelete={onDelete ?? (() => setDialog({ kind: 'delete', asset }))}
    />
  )

  return (
    <WorksheetLayout
      title="Project Worksheet"
      breadcrumbs={<Breadcrumbs items={[{ label: project.name }]} />}
      actions={
        <div className="flex items-center gap-3">
          <SaveStatus status={status} error={error} />
          <ImportAsepriteButton project={project} onImport={update} />
          <Button variant="outline" onClick={() => void exportFile()}>
            <Download aria-hidden="true" />
            Export
          </Button>
          <ToolButton
            label="Undo"
            disabled={!history.canUndo}
            onClick={history.undo}
          >
            <Undo2 />
          </ToolButton>
          <ToolButton
            label="Redo"
            disabled={!history.canRedo}
            onClick={history.redo}
          >
            <Redo2 />
          </ToolButton>
        </div>
      }
      className="flex gap-7 overflow-auto px-6 py-5"
    >
      <ProjectFields
        project={project}
        update={history.change}
        onEndTyping={history.endGroup}
      />

      {/* Assets */}
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <AssetSection
          title="Sprite sets"
          addLabel="New sprite set"
          onAdd={() =>
            update((p) =>
              addAsset(
                p,
                'spriteSets',
                createSpriteSet({ name: nextName('Sprites', p.spriteSets) }),
              ),
            )
          }
        >
          {project.spriteSets.map((set) => (
            <AssetCard
              key={set.id}
              name={set.name}
              meta={`${set.sprites.length} sprite${set.sprites.length === 1 ? '' : 's'} · MC ${COLOR_NAMES[set.multicolor1]} / ${COLOR_NAMES[set.multicolor2]}`}
              link={{
                to: '/projects/$projectId/sprites/$setId',
                params: { projectId, setId: set.id },
              }}
              thumbnail={<SpriteSetThumbnail set={set} />}
              menu={menuFor({ kind: 'spriteSets', id: set.id, name: set.name })}
            />
          ))}
        </AssetSection>

        <AssetSection
          title="Character sets"
          addLabel="New charset"
          onAdd={() => setDialog({ kind: 'newCharset' })}
        >
          {project.charsets.map((cs) => (
            <AssetCard
              key={cs.id}
              name={cs.name}
              meta={`${MODE_LABEL[cs.mode]} · used by ${mapsUsingCharset(project, cs.id).length} map(s)`}
              link={{
                to: '/projects/$projectId/charsets/$charsetId',
                params: { projectId, charsetId: cs.id },
              }}
              thumbnail={<CharsetThumbnail charset={cs} />}
              menu={menuFor(
                { kind: 'charsets', id: cs.id, name: cs.name },
                // A charset that maps use needs them moved first.
                mapsUsingCharset(project, cs.id).length > 0
                  ? () => setDialog({ kind: 'deleteCharset', charset: cs })
                  : undefined,
              )}
            />
          ))}
        </AssetSection>

        <AssetSection
          title="Screen maps"
          addLabel="New map"
          addDisabledReason={
            project.charsets.length === 0 ? 'Create a charset first' : undefined
          }
          onAdd={() => setDialog({ kind: 'newMap' })}
        >
          {project.maps.map((map) => {
            const charset = project.charsets.find((c) => c.id === map.charsetId)
            return (
              <AssetCard
                key={map.id}
                name={map.name}
                meta={`${map.width}×${map.height} · ${charset?.name ?? 'missing charset'}`}
                link={{
                  to: '/projects/$projectId/maps/$mapId',
                  params: { projectId, mapId: map.id },
                }}
                thumbnail={<MapThumbnail map={map} charset={charset} />}
                menu={menuFor({ kind: 'maps', id: map.id, name: map.name })}
              />
            )
          })}
        </AssetSection>
      </div>

      <PromptDialog
        open={dialog?.kind === 'rename'}
        onOpenChange={close}
        title="Rename"
        label="Name"
        initialValue={dialog?.kind === 'rename' ? dialog.asset.name : ''}
        onSubmit={(name) =>
          dialog?.kind === 'rename' &&
          update((p) =>
            renameAsset(p, dialog.asset.kind, dialog.asset.id, name),
          )
        }
      />
      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        onOpenChange={close}
        title={`Delete “${dialog?.kind === 'delete' ? dialog.asset.name : ''}”?`}
        description="You can undo this."
        onConfirm={() => {
          if (dialog?.kind !== 'delete') return
          const { kind, id } = dialog.asset
          update((p) =>
            kind === 'spriteSets'
              ? removeSpriteSet(p, id)
              : kind === 'maps'
                ? removeMap(p, id)
                : removeCharset(p, id),
          )
        }}
      />
      {dialog?.kind === 'deleteCharset' && (
        <DeleteCharsetDialog
          project={project}
          charset={dialog.charset}
          onOpenChange={close}
          onConfirm={(reassignTo) =>
            update((p) => removeCharset(p, dialog.charset.id, { reassignTo }))
          }
        />
      )}
      {dialog?.kind === 'newCharset' && (
        <NewCharsetDialog
          project={project}
          onOpenChange={close}
          onCreate={({ name, start }) =>
            update((p) =>
              addAsset(
                p,
                'charsets',
                createCharset({
                  name,
                  ...(start === 'blank' ? {} : { data: petsciiData(start) }),
                }),
              ),
            )
          }
        />
      )}
      {dialog?.kind === 'newMap' && (
        <NewMapDialog
          project={project}
          onOpenChange={close}
          onCreate={(init) =>
            update((p) => addAsset(p, 'maps', createCharmap(init)))
          }
        />
      )}
    </WorksheetLayout>
  )
}
