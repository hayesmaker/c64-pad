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

## Platform differences (planned)

- **DATA bytes, decimal / hex.** On touch devices (tablet, phone) tapping the
  DATA column switches decimal and hex; there is no separate switch. On the
  desktop (Electron) app the column should get a visible Dec | Hex switch,
  because there the bytes will be editable cells: click a byte and type a
  value to change the pixels. Keep the tap-to-switch behaviour for touch.

## Tracing paper

A reference image over a Sprite or Screen worksheet grid, opened from the
header (Tracing paper button; the eye button shows / hides it). Its settings
replace the left panel until Done. The image is cropped, sized (1:1, fit
width / height / all, stretch, custom %), anchored (3 × 3) and nudged in C64
pixels (8 = a char), drawn nearest-neighbour at an opacity, either over
everything or only under empty cells (transparent sprite pixels, map cells
holding the Blank Char). Stored per sprite / map in its own IndexedDB
database (`c64-pad-tracings`), never in projects or `.c64pad` files.

**Chars trace from the screens.** The Character Worksheet has no image of its
own: it shows the 8 × 8 part of a Screen's tracing under one map cell (the
map's placement shifted so that cell sits on the char grid; nothing is
cropped or copied, so nudging or replacing the screen's image carries
through). The cell is the char's **pin**, if it has one, else each place the
char is painted on a traced screen using this charset (Blank Char cells
skipped), stepped through with ‹ ›. The Screen Worksheet's **Pin** tool pins
the brush char to the tapped cell (a block brush pins each of its chars), so
a char can be drawn before it's placed. Pins, opacity and over / under are
kept per charset in localStorage on the device.

## Getting around a big map

When a map doesn't fit the frame, a **Navigator** sits in the bottom-right
corner of the map (worksheet and Zen mode): the whole map in miniature, with
the tracing image, and the visible part boxed in yellow. Tap to jump there;
drag the box to move it. It folds away to a button. It grows with the frame
(up to 240 × 360 px) so tall or wide maps get a usable strip.

On the desktop the wheel zooms around the cursor, Shift + wheel pans sideways
and Alt + wheel pans up and down (all grids, not only maps). Touch: pinch to
zoom, two fingers to pan. The **Hand** tool (map tool rail and map Zen mode)
makes one finger or the mouse drag the map instead of drawing; a second
finger still pinches.

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
