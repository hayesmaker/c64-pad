/** A change that would break a C64 constraint or the project's integrity. */
export class ModelError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ModelError'
  }
}
