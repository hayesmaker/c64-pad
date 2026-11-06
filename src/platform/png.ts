import { PALETTE } from '@/c64/palette'
import type { C64Color } from '@/c64/palette'
import type { IndexedImage } from '@/c64/render'

/**
 * Encode an indexed C64 image as PNG bytes, scaled up with crisp pixels.
 * Transparent pixels (-1) stay transparent unless a background is given.
 */
export async function indexedImageToPng(
  image: IndexedImage,
  {
    scale = 1,
    background = null,
  }: { scale?: number; background?: C64Color | null } = {},
): Promise<Uint8Array> {
  const canvas = document.createElement('canvas')
  canvas.width = image.width * scale
  canvas.height = image.height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')
  if (background !== null) {
    ctx.fillStyle = PALETTE[background].hex
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const index = image.pixels[y * image.width + x]
      if (index < 0) continue
      ctx.fillStyle = PALETTE[index].hex
      ctx.fillRect(x * scale, y * scale, scale, scale)
    }
  }
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  )
  if (!blob) throw new Error('Could not encode PNG')
  return new Uint8Array(await blob.arrayBuffer())
}
