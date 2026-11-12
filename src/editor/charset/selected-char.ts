/**
 * The char selected on the Character Worksheet, per charset, for this app
 * session. The Screen Worksheet sets it to its brush char, so CHARS opens
 * on the char being painted with.
 */
const selected = new Map<string, number>()

export const getSelectedChar = (charsetId: string) => selected.get(charsetId)

export function setSelectedChar(charsetId: string, char: number) {
  selected.set(charsetId, char)
}
