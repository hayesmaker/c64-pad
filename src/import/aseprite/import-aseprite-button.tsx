import { useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { FileUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImportAsepriteDialog } from './import-dialog'
import { AsepriteError, parseAseprite } from './parse'
import type { Project } from '@/c64/project'
import type { AsepriteFile } from './import-dialog'

/** "Import Aseprite": pick a file, read it, and open the import dialog. */
export function ImportAsepriteButton({
  project,
  onImport,
}: {
  project: Project
  onImport: (change: (p: Project) => Project) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<AsepriteFile | null>(null)

  const open = async (picked: File) => {
    const fileName = picked.name
    try {
      const doc = await parseAseprite(
        new Uint8Array(await picked.arrayBuffer()),
      )
      setFile({ fileName, doc })
    } catch (e) {
      const message =
        e instanceof AsepriteError
          ? e.message
          : `Couldn't read the file (${(e as Error).message})`
      setFile({ fileName, error: message })
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => input.current?.click()}>
        <FileUp aria-hidden="true" />
        Import Aseprite
      </Button>
      <input
        ref={input}
        type="file"
        // Android's picker filters by MIME type and has none for .aseprite,
        // so any filter there greys the file out. Accept anything; import checks.
        accept={Capacitor.isNativePlatform() ? undefined : '.aseprite,.ase'}
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0]
          e.target.value = ''
          if (picked) void open(picked)
        }}
      />
      {file && (
        <ImportAsepriteDialog
          file={file}
          project={project}
          onOpenChange={(isOpen) => !isOpen && setFile(null)}
          onImport={onImport}
        />
      )}
    </>
  )
}
