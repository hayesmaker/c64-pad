import { openDB } from 'idb'
import { migrateProject } from './project-file'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { Project } from '@/c64/project'

/** What the My Projects page needs, without loading pixel data into the UI. */
export interface ProjectSummary {
  id: string
  name: string
  program: string
  updatedAt: string
  counts: {
    spriteSets: number
    sprites: number
    charsets: number
    maps: number
  }
}

export interface ProjectRepository {
  list: () => Promise<Array<ProjectSummary>>
  get: (id: string) => Promise<Project | undefined>
  save: (project: Project) => Promise<void>
  delete: (id: string) => Promise<void>
}

interface C64PadDB extends DBSchema {
  projects: { key: string; value: Project; indexes: { updatedAt: string } }
}

export const DB_NAME = 'c64-pad'
const DB_VERSION = 1

export function summarize(p: Project): ProjectSummary {
  return {
    id: p.id,
    name: p.name,
    program: p.program,
    updatedAt: p.updatedAt,
    counts: {
      spriteSets: p.spriteSets.length,
      sprites: p.spriteSets.reduce((n, s) => n + s.sprites.length, 0),
      charsets: p.charsets.length,
      maps: p.maps.length,
    },
  }
}

/** Projects stored in IndexedDB (structured clone keeps Uint8Arrays as-is). */
export function createIndexedDbRepository(name = DB_NAME): ProjectRepository {
  let db: Promise<IDBPDatabase<C64PadDB>> | undefined
  const open = () =>
    (db ??= openDB<C64PadDB>(name, DB_VERSION, {
      upgrade(database) {
        const store = database.createObjectStore('projects', { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt')
      },
    }))

  return {
    async list() {
      const all = await (await open()).getAll('projects')
      return all
        .map((p) => summarize(p))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },
    async get(id) {
      const raw = await (await open()).get('projects', id)
      return raw && migrateProject(raw)
    },
    async save(project) {
      await (await open()).put('projects', project)
    },
    async delete(id) {
      await (await open()).delete('projects', id)
    },
  }
}

/** The app-wide repository. */
export const projectRepository: ProjectRepository = createIndexedDbRepository()
