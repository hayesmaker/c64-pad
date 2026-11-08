# Aseprite import: plan

Import an Aseprite project's **tileset** (as a charset) and **tilemap** (as a screen map) into an existing C64-Pad project, starting from the Project Worksheet (project overview).

Two parts:

1. **Project colour palette**: each project picks one of the common C64 emulator palettes. This comes first because the importer matches the file's colours against these palettes.
2. **Aseprite importer**: parser → validator → converter → import dialog.

Tracked in `docs/TODO.md` under _M10: Project palettes + Aseprite import_.

---

## Key point: colours are indices

Everything C64-Pad stores is a colour **index** (0–15): sprite colours, char colours, bg/MC registers. A palette only decides how those indices look on screen (and in PNG exports). Changing the palette never changes charsets, maps, sprites or any `.bin` / `.asm` / `.ctm` / `.spd` export.

So when an imported file uses a different palette from the project, "switch the project to the file's palette" and "convert to the project's palette" give **identical data**. The only difference is how the project looks.

---

## Part 1: project colour palette

### Current state

- `src/c64/palette.ts` has one hard-coded `PALETTE` (Colodore values plus colour names).
- About 20 files read `PALETTE[i].hex` directly, including editors, thumbnails, `platform/png.ts` and `editor/pixel-grid.tsx`. `components/c64/indexed-canvas.tsx` and `editor/map/map-canvas.tsx` build RGB tables once at module load.
- `export/sprites.ts` only uses colour names, so it isn't affected.

### 1.1 Model (`src/c64/palette.ts`)

- Separate names from values:
  - `COLOR_NAMES`: Black, White, … Light Grey (fixed; used for labels and ASM comments).
  - `PALETTES: Record<PaletteId, { name, source, hex: string[16] }>`.
  - `DEFAULT_PALETTE = 'colodore'`, so existing projects look the same as before.
- Palettes:

  | Id          | Name             | Notes                                                            |
  | ----------- | ---------------- | ---------------------------------------------------------------- |
  | `colodore`  | Colodore         | Pepto's 2017 model; the current C64-Pad palette                  |
  | `pepto`     | Pepto (PAL)      | Pepto's original 2001 measurements; Aseprite's usual C64 palette |
  | `vice`      | VICE default     | VICE's default palette                                           |
  | `ccs64`     | CCS64            |                                                                  |
  | `frodo`     | Frodo            |                                                                  |
  | `c64hq`     | C64HQ            |                                                                  |
  | `community` | Community Colors | See below                                                        |

- Take the values from VICE's `data/C64/*.vpl` files and the original Colodore and Pepto references, not from memory. The user does a quick check against their emulator.
- **Community Colors**: a palette tuned by people in the C64 community from real machines on CRTs, as an alternative to the measured palettes. It's the one entry whose source and exact values still need confirming. Before adding it, check whether VICE ships a `.vpl` for it; if there's no reliable source, drop it from the list.
- Helpers (unit-tested):
  - `paletteRgb(id)`: a cached RGB table for the canvases.
  - `nearestColor(rgb, id)`: nearest index by RGB distance.
  - `matchPalette(colours)`: for each palette, the worst nearest-colour distance and whether every colour is an exact match. Used by the importer.

### 1.2 Project field + migration

- Add `palette: PaletteId` to `Project`. The palette is **per project** and travels in the `.c64pad` file. There's no app-wide default; new projects get Colodore.
- Bump `PROJECT_VERSION` to 2. `migrateProject` sets `palette: 'colodore'` for v1 projects and files.
- `validateProject` falls back to the default for an unknown palette id instead of failing.
- Bumping the version means an older app build refuses a v2 file instead of silently dropping the palette.
- `setProjectPalette(project, id)` in `project.ts`. It goes through `update()`, so it can be undone like any other edit.

### 1.3 Rendering uses the project palette

- `PaletteProvider` in `routes/projects.$projectId.tsx`, read with `usePalette()`, which returns `{ id, hex(i), rgb }`.
- Replace `PALETTE[i].hex` with `palette.hex(i)` and `PALETTE[i].name` with `COLOR_NAMES[i]` at each call site.
- Code outside React gets the palette as a parameter:
  - `platform/png.ts` takes the palette, so PNG exports match the screen.
  - `indexed-canvas.tsx` and `map-canvas.tsx` move their module-level RGB tables to `paletteRgb(id)`. Their redraw triggers include the palette id, so switching palettes repaints straight away.
- My Projects thumbnails are outside the project route, so they get `project.palette` passed in.
- Out of scope: c64-ready draws with its own palette when "Run" is pressed. Matching that is a separate emulator change.

### 1.4 Selector UI (Project Worksheet)

- A **Colour palette** field in the worksheet fields block. It opens a picker listing each palette as its name plus a strip of 16 swatches, with the current one marked.
- Picking a palette changes it immediately and repaints the overview thumbnails. Undo reverts it.
- Hint: "Changes how colours look in C64-Pad only. Your data and exports are unchanged."
- Tablet rules apply: large touch targets, no hover-only previews.

### 1.5 Tests

- Every palette has 16 valid hex values, and the names line up.
- Migration: a v1 project loads as `colodore`, and v2 survives a round trip.
- Rendering the same data with two palettes gives different pixels, with the same indices underneath.
- `matchPalette`: the Rainbow Islands fixture colours (`#883932`, `#67b6bd`, `#40318d`, …) should match **Pepto** exactly. Confirm this once the tables are in.

---

## Part 2: Aseprite importer

### What the sample files contain

Fixtures are in `src/import/aseprite/__fixtures__/` (from `rainbow-islands-ce/art/design/`).

| File              | Format                             | Tileset            | Tilemap layer                                          | Other layers       |
| ----------------- | ---------------------------------- | ------------------ | ------------------------------------------------------ | ------------------ |
| `island1_round4`  | 32-bit RGBA, opaque                | 69 × 8×8           | 40×159 at 0,0                                          | none               |
| `island-8-1_test` | 8-bit indexed, transparent index 8 | 40 × 8×8           | 40×222 at 0,272 px (34 rows down) on a 320×2048 canvas | "Background" image |
| `island-8-2_test` | 8-bit indexed, transparent index 8 | 29 × 8×8 (18 used) | 40×256 at 0,0                                          | "Background" image |

- **Colours:** all three use Pepto-style colour values (the 8-bit files have a 16-entry palette in C64 order).
- **Mixed modes:** each tileset mixes hires tiles with multicolour tiles that have double-wide pixels. A brute-force background/MC1/MC2 search fits **every** tile into one multicolour charset:
  - `island1_round4`: background 6, MC1 7, MC2 8.
  - `island-8-1_test`: MC1 1; transparent background.
  - `island-8-2_test`: MC1 7; transparent background.
- **Tile 0:** Aseprite reserves tile 0 as the empty tile, so tile _n_ becomes screen code _n_.
- **Tile properties:** tiles in `island-8-1_test` carry user data (`"solid"`). C64-Pad has nowhere to store this yet.
- **Mismatched grid:** `island-8-2_test` has a 16×16 canvas grid but an 8×8 tileset. Only the tileset's tile size matters.

### 2.1 Parser (`src/import/aseprite/parse.ts`)

Pure TS, no UI. Reads the header, frames and these chunks:

- Layer (`0x2004`): name, type (normal / group / tilemap), visibility, tileset index.
- Cel (`0x2005`): position, and for compressed tilemap cels (type 3): size, tile id mask, flip bits, tile ids.
- Tileset (`0x2023`): tile count and size, embedded compressed pixels. External tilesets are reported as unsupported.
- Palette (`0x2019`, and the old `0x0004` when that's the only one, as in the fixtures).
- User data (`0x2020`): attached to the preceding layer, cel or tile.
- Any other chunk is skipped.

Decompress with the browser's built-in `DecompressionStream('deflate')` (no new dependency; works in the Android WebView). It's async; if that's a problem, use `fflate` instead.

Returns a plain `AsepriteDoc`: size, colour depth (8 / 16 / 32-bit), palette, transparent index, layers, tilesets (pixels as RGBA, with transparent pixels marked) and tilemap cels.

### 2.2 Validator (`src/import/aseprite/validate.ts`)

Runs as soon as a file is picked. Returns **errors** (block import), **warnings** (import goes ahead) and the facts the dialog needs.

**Structure (the gate):**

- At least one tilemap layer with a cel, pointing at a tileset. Otherwise the import is blocked: "No tilemap layer found".
- Tiles are 8×8. Otherwise: "Tiles are 16×16; only 8×8 is supported".
- Tile count ≤ 256, including the empty tile 0.
- No flipped or rotated tiles (the C64 can't flip characters).
- Map size ≤ `MAX_MAP_SIZE` (1024) in both directions.
- Warnings for anything not imported:
  - extra image layers ("Background" is ignored)
  - extra frames (only frame 1 is used)
  - more than one tilemap layer (the dialog lets you pick one)
  - tile user data (properties such as "solid" are not imported)

**Colours (uses Part 1):**

- `matchPalette` on the file's colours. The outcome drives the palette step in the dialog (2.4).
- Map each pixel to a C64 index with `nearestColor` against the chosen palette. Transparent pixels become the background.

**C64 fit:**

- Classify each tile:
  - hires: background + one colour.
  - multicolour candidate: every pixel pair is identical (double-wide pixels).
- Search every background / MC1 / MC2 combination (16 × 120, which is instant) for the one that fits the most tiles:
  - A hires tile fits if it uses at most one non-background colour, and in multicolour mode that colour is 0–7.
  - A multicolour tile fits if, after background / MC1 / MC2, at most one colour is left and it's 0–7.
- **Background colour:** if the file shows it (opaque tile pixels, like `island1_round4`), use the solver's choice. If not (transparent tiles), use **blue (6)**. It's easy to change in the charset editor afterwards.
- Charset mode: hires if every tile fits as hires, otherwise multicolour. ECM is not considered.
- List each tile that doesn't fit, with the reason (e.g. "tile 25: hires pixels in 2 non-background colours"). Tiles that don't fit still import, best-effort, but you're warned first.

### 2.3 Converter (`src/import/aseprite/convert.ts`)

Pure functions:

- **Charset:**
  - Mode, background / MC1 / MC2 from the validator, which you can override in the dialog.
  - Each tile encoded into char _n_, using the existing `setCharMulticolor` / `setCharColor` rules (bit 3 of the colour marks a multicolour char).
  - Chars past the tile count stay blank.
- **Map:**
  - Tile id becomes the screen code.
  - **No cropping:** the map is the full canvas size in chars (`canvasWidth / 8 × canvasHeight / 8`), with the tilemap cel placed at its offset. Cells outside the cel get the map's `blank` code. So `island-8-1_test` becomes 40×256, with 34 blank rows above the tiles.
- Unit-tested against the three fixtures. Example: `island1_round4` gives a multicolour charset with background 6, MC1 7, MC2 8 and a 40×159 map.

### 2.4 Import dialog (Project Worksheet)

- **Entry point:** an "Import Aseprite…" button in the Project Worksheet header, next to Export. It uses the same file input as My Projects, including the Android fix that removes the file-type filter so `.aseprite` files can be picked.
- **Step 1, report:**
  - File summary, with ✓/✗ for each structure check.
  - The fit result, and warnings.
  - Errors disable Import.
- **Step 2, palette** (from `matchPalette`):

  | Result                                                                                        | Dialog                                                                                                            |
  | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
  | Exact match with the project palette                                                          | No question; carry on.                                                                                            |
  | Exact match with another palette (e.g. the fixtures → Pepto while the project is on Colodore) | "This file uses **Pepto**. **Switch project to Pepto** / **Keep Colodore**". Both give identical data.            |
  | Close to a palette, not exact                                                                 | Convert to the nearest colours, and show the worst colour distance. Offer to switch to the best-matching palette. |
  | Nothing close                                                                                 | Warn, convert to the nearest project colours, and list the colours that had to be guessed.                        |

- **Step 3, targets:**
  - **Charset:** new charset (default; named after the file) or replace an existing one. Replacing warns which maps use it.
  - **Map:** new screen map (default) using that charset, replace an existing map, or none (tiles only).
  - Tilemap layer picker, if there's more than one.
  - Background / MC1 / MC2, already set from the validator. Changing them re-runs the fit check.
- **Import:**
  - One `update((p) => …)`: optional `setProjectPalette`, then add or replace the charset and map.
  - `checkIntegrity` runs as usual, and one undo reverts the whole import.

### 2.5 Later (not in the first pass)

- Import into free slots of an existing charset (needs screen codes renumbered).
- 16×16 (or larger) tilesets as 2×2 char metatiles, like CharPad tiles / blocks.
- Somewhere to store tile properties (e.g. "solid") and carry them into the CharPad export.
- Use the Aseprite "Background" layer's main colour as the background colour.
- Import from the charset and map editors too.
- Optional cropping of offset maps to the cel.

---

## Order of work

1. Part 1: palette tables and helpers → project field and migration → rendering through `usePalette` → selector UI.
2. Part 2: parser and fixture tests → validator → converter → import dialog.
