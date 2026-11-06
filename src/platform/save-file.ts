import { Capacitor } from '@capacitor/core'

/**
 * Save a text file. In the browser this downloads it; in the Android app it
 * writes to the app cache and opens the share sheet (Files, Drive, email…).
 */
export async function saveTextFile(
  filename: string,
  text: string,
  mimeType = 'application/json',
): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } =
      await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    })
    await Share.share({ title: filename, files: [uri] })
    return
  }
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
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
