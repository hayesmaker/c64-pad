import { Capacitor } from '@capacitor/core'
import { bytesToBase64 } from '@/storage/bytes'

/**
 * Save a file. In the browser this downloads it; in the Android app it writes
 * to the app cache and opens the share sheet (Files, Drive, email…).
 */
export async function saveFile(
  filename: string,
  data: string | Uint8Array,
  mimeType = 'application/octet-stream',
): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } =
      await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const { uri } = await Filesystem.writeFile(
      typeof data === 'string'
        ? {
            path: filename,
            data,
            directory: Directory.Cache,
            encoding: Encoding.UTF8,
          }
        : // Without an encoding, Filesystem expects base64 and writes raw bytes.
          {
            path: filename,
            data: bytesToBase64(data),
            directory: Directory.Cache,
          },
    )
    await Share.share({ title: filename, files: [uri] })
    return
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
