# C64-Pad: Design

Approved mock-ups (sprite and character worksheets, Zen mode):
https://claude.ai/artifact/NrarDz6ngDzkTNvasy95WU

## Principles

- **Worksheet on a desk.** Each page is a paper sheet with a thin pencil-grey
  border on a slightly darker desk background. The header centres the sheet
  title between double rules ("Sprite Worksheet", "Character Worksheet",
  "Screen Worksheet").
- **Edge tabs** on the sheet's right edge switch between editors (SPRITES /
  CHARS / SCREEN), like a workbook's section tabs.
- **Show the machine.** Bit-weight headers (`128 … 1`), row numbers, heavy
  lines at byte and 7-row boundaries, and a live DATA column aligned to the
  grid rows. Mode switches reinterpret the same bytes, as the VIC-II does.
- **Touch first.** Targets ≥ 44px where possible; editor surfaces use the
  `.touch-surface` class (no browser gestures, no selection).
- **Landscape first.** MVP targets tablets in landscape. Portrait tablet and
  phone layouts come after MVP. Reference device: RedMagic Astra 2, a
  **1066×668 CSS px** viewport in landscape (2400×1504 screen at 360 dpi,
  DPR 2.25). The mock-up is
  1280×800, so editor layouts must also fit the smaller size.

## Tokens (`src/styles.css`)

| Token                       | Value                 | Use                                            |
| --------------------------- | --------------------- | ---------------------------------------------- |
| `desk`                      | `#e9e7df`             | App background around the sheet                |
| `paper`                     | `#fdfcf8`             | Sheet, inputs (`--background`)                 |
| `foreground`                | `#2b2b28`             | Text                                           |
| `muted-foreground`          | `#66645e`             | Labels, bit headers (≥ 4.5:1 on paper)         |
| `rule`                      | `#8f8d86`             | Sheet border, input borders, double rules      |
| `rule-soft`                 | `#c9c7bf`             | Dividers, idle button borders (`--border`)     |
| `grid-minor` / `grid-major` | `#e0ded6` / `#8f8d86` | Pixel grid lines                               |
| `primary`                   | `#2e2c9b` (C64 blue)  | Accent: active tool, selection, primary button |
| `accent`                    | `#eeedf8`             | Selected-row tint                              |
| `tab` / `tab-inactive`      | `#5f5d57` / `#d3d1c9` | Edge tabs                                      |
| `c64-screen` / `c64-border` | `#2e2c9b` / `#706deb` | Previews on a C64 screen                       |

Type: **IBM Plex Sans** (UI; 300 for sheet titles) and **IBM Plex Mono**
(numbers, bytes, bit headers), bundled via `@fontsource` so the Android
app works offline. Radius 8px for controls, 10px for the sheet.

## Dark mode

Follows the device's light/dark setting (`prefers-color-scheme`); no in-app
switch for MVP. Tokens are redefined in `src/styles.css`: "the worksheet on a
desk at night": desk `#121210`, paper `#1f1e1b`, rules `#7b7972` /
`#3b3a36`, text `#e8e6df`, and C64 light blue `#8b88f2` as the accent
(C64 blue is too dark to read on charcoal). C64 colours inside grids,
previews and sheets never change. Canvases read tokens with `cssVar()` and
redraw on a scheme change (`useColorScheme()` in `src/lib/theme.ts`); use
tokens, never hex, in components.

## Components (`src/components/worksheet/`)

- `WorksheetLayout`: desk, sheet, header (breadcrumbs, title, actions), optional tabs
- `Breadcrumbs`: `C64-Pad / Project / Asset`
- `EdgeTabs` + `editorTabs()`: the right-edge editor tabs
- `Field` + `worksheetInputClass`: small grey label above a control

## Later

- **Printable blank worksheets**: a print stylesheet / PDF export of each
  editor page with empty grids, for designing on paper. Render from the
  same components so print and screen stay in step.
- Portrait tablet and phone layouts.
- An in-app theme switch (MVP follows the device setting).
