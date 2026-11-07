/**
 * Tracing paper: a reference image shown over (or under) a worksheet grid to
 * draw from. These are the pure parts: settings and where the image lands.
 * All target sizes and positions are in C64 pixels (hires pixels).
 */

export type TracingSize =
  'one' | 'width' | 'height' | 'fit' | 'stretch' | 'custom'

export interface TracingSettings {
  /** Pixels cut off each edge of the image. */
  crop: { top: number; bottom: number; left: number; right: number }
  size: TracingSize
  /** Scale for size 'custom', in percent. */
  customPercent: number
  /** 0-8: top left, top, top right, left, centre, right, bottom left, bottom, bottom right. */
  anchor: number
  /** Moved by this many C64 pixels after anchoring. */
  nudge: { x: number; y: number }
  /** 0.1-1. */
  opacity: number
  /** Over the drawing, or only where the grid is still empty. */
  layer: 'over' | 'under'
  visible: boolean
}

export const DEFAULT_TRACING: TracingSettings = {
  crop: { top: 0, bottom: 0, left: 0, right: 0 },
  size: 'one',
  customPercent: 100,
  anchor: 0,
  nudge: { x: 0, y: 0 },
  opacity: 0.5,
  layer: 'over',
  visible: true,
}

export interface Placement {
  /** Part of the image used (after cropping), in image pixels. */
  source: { x: number; y: number; width: number; height: number }
  /** Where it goes, in C64 pixels of the target (may stick out). */
  target: { x: number; y: number; width: number; height: number }
  scaleX: number
  scaleY: number
}

/** Crop kept inside the image, leaving at least 1 × 1 pixel. */
export function clampCrop(
  crop: TracingSettings['crop'],
  imageWidth: number,
  imageHeight: number,
): TracingSettings['crop'] {
  const c = (n: number) => Math.max(0, Math.round(n))
  const left = Math.min(c(crop.left), imageWidth - 1)
  const right = Math.min(c(crop.right), imageWidth - 1 - left)
  const top = Math.min(c(crop.top), imageHeight - 1)
  const bottom = Math.min(c(crop.bottom), imageHeight - 1 - top)
  return { top, bottom, left, right }
}

/** Where the (cropped, scaled, anchored, nudged) image sits on the target. */
export function placeTracing(
  image: { width: number; height: number },
  target: { width: number; height: number },
  settings: TracingSettings,
): Placement {
  const crop = clampCrop(settings.crop, image.width, image.height)
  const sw = image.width - crop.left - crop.right
  const sh = image.height - crop.top - crop.bottom
  let scaleX = 1
  let scaleY = 1
  switch (settings.size) {
    case 'width':
      scaleX = scaleY = target.width / sw
      break
    case 'height':
      scaleX = scaleY = target.height / sh
      break
    case 'fit':
      scaleX = scaleY = Math.min(target.width / sw, target.height / sh)
      break
    case 'stretch':
      scaleX = target.width / sw
      scaleY = target.height / sh
      break
    case 'custom':
      scaleX = scaleY = Math.max(1, settings.customPercent) / 100
      break
    case 'one':
      break
  }
  const width = sw * scaleX
  const height = sh * scaleY
  const ax = (settings.anchor % 3) / 2
  const ay = Math.floor(settings.anchor / 3) / 2
  return {
    source: { x: crop.left, y: crop.top, width: sw, height: sh },
    target: {
      x: (target.width - width) * ax + settings.nudge.x,
      y: (target.height - height) * ay + settings.nudge.y,
      width,
      height,
    },
    scaleX,
    scaleY,
  }
}

/** How the cropped image compares with the target, for the size check. */
export function sizeCheck(
  image: { width: number; height: number },
  target: { width: number; height: number },
  crop: TracingSettings['crop'],
): { width: number; height: number; wider: number; taller: number } {
  const c = clampCrop(crop, image.width, image.height)
  const width = image.width - c.left - c.right
  const height = image.height - c.top - c.bottom
  return {
    width,
    height,
    wider: width - target.width,
    taller: height - target.height,
  }
}

/** What a grid needs to draw tracing paper. */
export interface GridTracing {
  image: CanvasImageSource
  placement: Placement
  opacity: number
  layer: 'over' | 'under'
}

/**
 * Draw the image at its placement, `px` canvas pixels per C64 pixel, in a
 * context already translated to the grid's origin. Nearest-neighbour, so
 * pixel-art references stay crisp.
 */
export function drawTracing(
  ctx: CanvasRenderingContext2D,
  tracing: GridTracing,
  px: number,
  /** The grid's size in canvas pixels: nothing is drawn outside it. */
  clip: { width: number; height: number },
) {
  const { source: s, target: t } = tracing.placement
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, clip.width, clip.height)
  ctx.clip()
  ctx.globalAlpha = tracing.opacity
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(
    tracing.image,
    s.x,
    s.y,
    s.width,
    s.height,
    t.x * px,
    t.y * px,
    t.width * px,
    t.height * px,
  )
  ctx.restore()
}
