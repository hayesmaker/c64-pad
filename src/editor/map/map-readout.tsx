import { decodeEcm } from '@/c64/charmap'
import { charColor, charCount } from '@/c64/charset'
import { COLOR_NAMES } from '@/c64/palette'
import { cellColorsOf, cellPixelColors } from '@/c64/render'
import { hex } from '../hex'
import type { Charmap } from '@/c64/charmap'
import type { Charset } from '@/c64/charset'

/** Where the cell lives in memory, as on the paper worksheet. */
export function Readout({
  map,
  charset,
  cell,
}: {
  map: Charmap
  charset: Charset
  cell: [number, number] | null
}) {
  const items: Array<[string, string]> = [
    ['Cell', '—'],
    ['Map byte · x + W·y', ''],
    ['Screen RAM · 1024 + x + 40·y', ''],
    ['Colour RAM · 55296 + x + 40·y', ''],
    ['Char · colour', ''],
  ]
  if (cell) {
    const [x, y] = cell
    const code = map.cells[y * map.width + x]
    const onScreen = x < 40 && y < 25
    const off = x + 40 * y
    const char = charset.mode === 'ecm' ? decodeEcm(code).char : code
    const color =
      char < charCount(charset.mode)
        ? COLOR_NAMES[charColor(charset, char)]
        : '—'
    items[0][1] = `x ${x}, y ${y}`
    items[1][1] = String(x + map.width * y)
    items[2][1] = onScreen
      ? `${1024 + off} (${hex(1024 + off, 4)})`
      : 'not on screen 0'
    items[3][1] = onScreen
      ? `${55296 + off} (${hex(55296 + off, 4)})`
      : 'not on screen 0'
    items[4][1] = `${hex(code)} · ${color}`
    if (charset.mode === 'bitmap') {
      const i = y * map.width + x
      const c = cellColorsOf(map, charset, i)
      const own = cellPixelColors(map, charset, i) ? ' (cell)' : ''
      items[4] = [
        'Tile · 01 / 10 / 11',
        `${hex(code)} · ${c
          .slice(1)
          .map((v) => COLOR_NAMES[v])
          .join(' / ')}${own}`,
      ]
    }
  }
  return (
    <dl className="mt-2 ml-[26px] grid shrink-0 grid-flow-col grid-rows-2 gap-x-4 gap-y-0.5 text-xs">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-mono">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
