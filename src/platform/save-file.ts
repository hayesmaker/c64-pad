import { Capacitor, registerPlugin } from '@capacitor/core'
import { bytesToBase64 } from '@/storage/bytes'

/** The app's own Android plugin (android/…/SaveAsPlugin.java). */
const SaveAs = registerPlugin<{
  save: (o: {
    filename: string
    /** Base64. */
    data: string
  }) => Promise<{ saved: boolean; uri?: string }>
}>('SaveAs')

/**
 * Save a file. In the browser this downloads it. In the Android app it opens
 * Android's "Save as" picker (choose a folder and name: Downloads, Documents,
 * Drive…); an app build without that plugin falls back to the share sheet.
 * Resolves false if the user cancelled the picker.
 */
export async function saveFile(
  filename: string,
  data: string | Uint8Array,
  mimeType = 'application/octet-stream',
): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    const bytes =
      typeof data === 'string' ? new TextEncoder().encode(data) : data
    if (Capacitor.isPluginAvailable('SaveAs')) {
      const { saved } = await SaveAs.save({
        filename,
        data: bytesToBase64(bytes),
      })
      return saved
    }
    await shareFile(filename, bytes)
    return true
  }
  const blob = new Blob(
    [typeof data === 'string' ? data : data.slice().buffer],
    { type: mimeType },
  )
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

/** Write to the app cache and open the share sheet (Files, Drive, email…). */
async function shareFile(filename: string, bytes: Uint8Array) {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const { Share } = await import('@capacitor/share')
  // Without an encoding, Filesystem expects base64 and writes raw bytes.
  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: bytesToBase64(bytes),
    directory: Directory.Cache,
  })
  await Share.share({ title: filename, files: [uri] })
}

/** Save a text file (kept for existing callers). */
export function saveTextFile(
  filename: string,
  text: string,
  mimeType = 'application/json',
) {
  return saveFile(filename, text, mimeType)
}

/** File-name-safe version of a project or asset name. */
export function safeFileName(name: string): string {
  return (
    name
      .trim()
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'untitled'
  )
}
