import { useEffect, useRef } from 'react'
import { PALETTE } from '@/c64/palette'
import { cn } from '@/lib/utils'
import type { IndexedImage } from '@/c64/render'

const RGB = PALETTE.map(({ hex }) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
])

/**
 * Draws an image of C64 colour indices at native resolution; CSS scales it up
 * with crisp pixels. Transparent pixels (-1) show the element's background.
 */
export function IndexedCanvas({
  image,
  className,
  label,
}: {
  image: IndexedImage
  className?: string
  label: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const data = ctx.createImageData(image.width, image.height)
    image.pixels.forEach((index, i) => {
      if (index < 0) return
      const [r, g, b] = RGB[index]
      data.data.set([r, g, b, 255], i * 4)
    })
    ctx.putImageData(data, 0, 0)
  }, [image])

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label}
      width={image.width}
      height={image.height}
      className={cn('[image-rendering:pixelated]', className)}
    />
  )
}
