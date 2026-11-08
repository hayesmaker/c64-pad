import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { usePalette } from './palette-context'
import type { IndexedImage } from '@/c64/render'

/**
 * Draws an image of C64 colour indices at native resolution; CSS scales it up
 * with crisp pixels. Transparent pixels (-1) show the element's background.
 */
export function IndexedCanvas({
  image,
  className,
  style,
  label,
}: {
  image: IndexedImage
  className?: string
  style?: React.CSSProperties
  label: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const { rgb } = usePalette()

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const data = ctx.createImageData(image.width, image.height)
    image.pixels.forEach((index, i) => {
      if (index < 0) return
      const [r, g, b] = rgb[index]
      data.data.set([r, g, b, 255], i * 4)
    })
    ctx.putImageData(data, 0, 0)
  }, [image, rgb])

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label}
      width={image.width}
      height={image.height}
      className={cn('[image-rendering:pixelated]', className)}
      style={style}
    />
  )
}
