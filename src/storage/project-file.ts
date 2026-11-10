import { createCharmap } from '@/c64/charmap'
import { createCharset } from '@/c64/charset'
import { PROJECT_VERSION, checkIntegrity } from '@/c64/project'
import { createSprite } from '@/c64/sprite'
import { createSpriteSet } from '@/c64/sprite-set'
import { DEFAULT_PALETTE_ID, isPaletteId } from '@/c64/palette'
import { base64ToBytes, bytesToBase64 } from './bytes'
import type { Project } from '@/c64/project'

/** File extension and identifier for exported projects. */
export const PROJECT_FILE_EXTENSION = '.c64pad'
export const PROJECT_FILE_FORMAT = 'c64pad-project'

export class ProjectFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProjectFileError'
  }
}

/** Serialise a project to the `.c64pad` JSON text format. */
export function exportProjectFile(project: Project): string {
  return JSON.stringify(
    { format: PROJECT_FILE_FORMAT, version: project.version, project },
    (_key, value: unknown) =>
      value instanceof Uint8Array ? { $bytes: bytesToBase64(value) } : value,
    2,
  )
}

/** Parse a `.c64pad` file, migrating and validating it. */
export function importProjectFile(text: string): Project {
  let parsed: unknown
  try {
    parsed = JSON.parse(text, (_key, value: unknown) =>
      isBytes(value) ? base64ToBytes(value.$bytes) : value,
    )
  } catch (e) {
    throw new ProjectFileError(
      `Not a valid project file (${(e as Error).message})`,
    )
  }
  if (!isRecord(parsed) || parsed.format !== PROJECT_FILE_FORMAT) {
    throw new ProjectFileError('Not a C64-Pad project file')
  }
  return migrateProject(parsed.project)
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isBytes(v: unknown): v is { $bytes: string } {
  return (
    isRecord(v) && typeof v.$bytes === 'string' && Object.keys(v).length === 1
  )
}

/**
 * Bring a stored or imported project up to the current version and validate it
 * by rebuilding every asset through the model's constructors.
 */
export function migrateProject(raw: unknown): Project {
  if (!isRecord(raw)) throw new ProjectFileError('Project data is missing')
  const version = raw.version
  if (typeof version !== 'number')
    throw new ProjectFileError('Project has no version')
  if (version > PROJECT_VERSION) {
    throw new ProjectFileError(
      `This project was saved by a newer C64-Pad (format ${version}); please update the app`,
    )
  }
  // v1 → v2: projects gained a display palette; v1 always showed Colodore,
  // which validateProject fills in.
  // v2 → v3: charsets gained char attributes and their names; createCharset
  // gives v2 charsets none (all 0, unnamed).
  return validateProject(raw as unknown as Project)
}

// Untrusted input: optional text fields may be missing in hand-edited files.
function validateProject(
  p: Partial<Project> & Pick<Project, 'spriteSets' | 'charsets' | 'maps'>,
): Project {
  try {
    const project: Project = {
      version: PROJECT_VERSION,
      id: String(p.id),
      name: String(p.name),
      program: String(p.program ?? ''),
      notes: String(p.notes ?? ''),
      // Missing (v1) or unknown (hand-edited): fall back rather than fail.
      palette: isPaletteId(p.palette) ? p.palette : DEFAULT_PALETTE_ID,
      dateDesigned: String(p.dateDesigned ?? ''),
      createdAt: String(p.createdAt),
      updatedAt: String(p.updatedAt),
      spriteSets: p.spriteSets.map((set) =>
        createSpriteSet({
          ...set,
          sprites: set.sprites.map((s) => createSprite(s)),
        }),
      ),
      charsets: p.charsets.map((cs) => createCharset(cs)),
      maps: p.maps.map((m) => createCharmap(m)),
    }
    checkIntegrity(project)
    return project
  } catch (e) {
    if (e instanceof ProjectFileError) throw e
    throw new ProjectFileError(
      `Project data is damaged (${(e as Error).message})`,
    )
  }
}
