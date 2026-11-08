import { useMemo } from 'react'
import { renderCharmap, renderCharsetSheet } from '@/c64/render'
import { SPRITE_RENDER_WIDTH, renderSprite } from '@/c64/sprite-set'
import { SPRITE_HEIGHT } from '@/c64/sprite'
import { usePalette } from '@/components/c64/palette-context'
import { IndexedCanvas } from './indexed-canvas'
import type { Charmap } from '@/c64/charmap'
import type { Charset } from '@/c64/charset'
import type { SpriteSet } from '@/c64/sprite-set'

const frame = 'flex h-28 items-center justify-center rounded-md border-[5px]'

/** First few sprites of the set on a C64-blue screen. */
export function SpriteSetThumbnail({ set }: { set: SpriteSet }) {
  const images = useMemo(
    () =>
      set.sprites.slice(0, 4).map((sprite) => ({
        id: sprite.id,
        name: sprite.name,
        image: {
          width: SPRITE_RENDER_WIDTH,
          height: SPRITE_HEIGHT,
          pixels: renderSprite(set, sprite),
        },
      })),
    [set],
  )
  return (
    <div className={`${frame} gap-2 border-c64-border bg-c64-screen`}>
      {images.map(({ id, name, image }) => (
        <IndexedCanvas key={id} image={image} label={name} className="w-12" />
      ))}
    </div>
  )
}

export function CharsetThumbnail({ charset }: { charset: Charset }) {
  const palette = usePalette()
  const image = useMemo(() => renderCharsetSheet(charset, 32), [charset])
  return (
    <div
      className={frame}
      style={{
        backgroundColor: palette.hex[charset.background],
        borderColor: palette.hex[charset.background],
      }}
    >
      <IndexedCanvas
        image={image}
        label={`${charset.name} characters`}
        className="max-h-full w-full"
      />
    </div>
  )
}

export function MapThumbnail({
  map,
  charset,
}: {
  map: Charmap
  charset?: Charset
}) {
  const image = useMemo(
    () => charset && renderCharmap(map, charset),
    [map, charset],
  )
  return (
    <div className={`${frame} border-c64-border bg-c64-screen`}>
      {image ? (
        <IndexedCanvas
          image={image}
          label={`${map.name} preview`}
          className="h-full"
        />
      ) : (
        <span className="text-sm text-white">No charset</span>
      )}
    </div>
  )
}
