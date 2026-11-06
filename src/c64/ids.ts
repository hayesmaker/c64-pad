/** Unique id for projects and assets. */
export function newId(): string {
  return crypto.randomUUID()
}
