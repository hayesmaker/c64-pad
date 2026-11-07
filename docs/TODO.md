# C64-Pad: Todo

Each `###` heading is intended to become a GitHub Milestone and each checkbox an Issue.
See `PLAN.md` → _Decisions_ for the reasoning behind these.

### M0: Foundations

- [x] Switch TanStack Start to SPA/static output; confirm `vite build` emits a self-contained `dist` usable offline
- [x] Add Vitest + a first test; add `typecheck` script (`tsc --noEmit`)
- [x] GitHub Actions CI: install, lint, typecheck, test, build
- [x] Capacitor Android shell: `@capacitor/core`, `cap add android`, build scripts, debug APK builds
- [x] Install and run on the tablet (RedMagic Astra 2 over Wi-Fi adb; see README)
- [x] Viewport/meta for tablet: disable browser pinch-zoom/overscroll on editor surfaces, `touch-action: none` on canvases
- [x] App shell + routes: `/`, `/projects`, `/projects/$projectId`, `/projects/$projectId/sprites/$setId`, `/projects/$projectId/charsets/$charsetId`, `/projects/$projectId/maps/$mapId`
- [x] Worksheet design system: Tailwind theme tokens (paper bg, grid greys, label font), field/box components, sheet header ("Sprite Worksheet" style); see `docs/DESIGN.md`

### M1: Core C64 model (pure TS, fully unit-tested)

- [x] C64 palette (16 colours, named; pick a standard e.g. Pepto/Colodore)
- [x] Bitplane helpers: get/set pixel for hires (1bpp) and multicolour (2bpp pairs)
- [x] Sprite model: 63 bytes, mode, sprite colour, overlay link, expand flags
- [x] Char model: 8 bytes; charset of 256 (64 in ECM) + per-char attribute colour
- [x] Sprite set model: sprites[], shared MC1/MC2, animations, overlay links
- [x] Charmap model: W×H of char indices + `charsetId` reference
- [x] Project model: name, program, notes, date; `spriteSets[]`, `charsets[]`, `maps[]` (each with id, name, notes); referential integrity helpers (charset in use by maps)
- [x] Mode-constraint rules (e.g. MC char requires colour ≥ 8; MC sprite pixel snapping) enforced in model, not UI
- [x] Undo/redo command stack (generic, per-document), with stroke coalescing

### M2: Persistence

- [x] IndexedDB repository (e.g. `idb`), autosave with debounce
- [x] My Projects page: list, create, rename, duplicate, delete, last-modified
- [x] Project page: list sprite sets / charsets / maps with thumbnails; add, rename, duplicate, delete assets (block/reassign when deleting a charset in use)
- [x] Project file export/import (`.c64pad` versioned JSON, with migration hook)

### M3: Sprite designer (MVP)

- [x] Editor pages fill exactly one screen (no page scroll); sheet body scrolls inside where needed
- [ ] Layout fits the target tablet viewport: **1200×752 CSS px** landscape (RedMagic Astra 2), as well as 1280×800
- [x] Canvas pixel grid renderer (24×21, double-wide cells in MC), 8-px column separators + 7-row bands like the worksheet
- [x] Bit-weight header (128…1 ×3) and row numbers; live DATA panel (3 bytes × 21 rows, dec/hex toggle)
- [x] Pointer input: draw/erase/fill, stylus + finger, gap-free strokes, palm rejection, second finger cancels stroke
- [x] Pinch-zoom / two-finger pan on the grid (1–8×), wheel zoom, zoom button; headers follow the pan
- [x] Colour panel: single colour / multicolour 00–11 legend like the worksheet; click-to-select active pen
- [x] Hires ↔ multicolour toggle with sensible conversion
- [x] Tools: flip H/V, shift/roll, clear, invert, copy/paste sprite
- [x] Sprite list within a set (sprite number, name), add/delete/reorder; switch between sets
- [x] Metadata fields: sprite name, notes (program and date designed live on the project page)
- [x] Actual-size + X/Y-expand preview
- [x] Animation: frame ranges, looping preview, speed control
- [x] Overlay: link hires sprite over MC sprite, combined preview, edit either layer
- [x] **Ship to tablet**: test full sprite flow on Android build (drawing, zoom button, animation on device; overlay in Chrome; pinch needs a human)

### M4: Exporters (sprites)

- [x] Raw `.bin`: 64 bytes/sprite (63 + zero pad or SpritePad attribute byte), selectable range
- [x] KickAssembler source: `.byte` lines with labels, row pictures, colour `.label`s (verified with KickAss 5)
- [x] SpritePad `.spd` V1 writer (spec from batchpad docs/spritepad.md)
- [ ] User verifies a `.spd` export opens correctly in SpritePad
- [x] PNG export (sheet & single, chosen scale, columns, transparent or screen colour)
- [x] Save/download via browser on web, Capacitor Filesystem/Share on Android (binary + text)
- [x] KickAss example loader snippet in docs (`docs/kickass-sprites.md`, both assembled and checked)

### M5: c64-ready integration

- [x] Add `c64-ready` npm dependency; copy its runtime assets (`c64.wasm`, audio worklet) into `public/c64/` before dev/build (`scripts/copy-c64-assets.mjs`)
- [x] `EmulatorOverlay` component wrapping `C64Player` + `CanvasRenderer` (deferred start + chained teardown, StrictMode-safe)
- [x] KickAss sprite-viewer stub (`stubs/sprite-viewer.asm`): 8 slots, overlays, MC colours, expand flags, loop/ping-pong animation; `npm run stubs` embeds it as TS
- [x] TS PRG builder (`src/emulator/sprite-viewer.ts`) + showcase layout; unit-tested; animation verified headless in c64-ready's core
- [x] "Run" button → embedded overlay; "Save .prg" in the overlay
- [x] Verify Run (incl. animation) on the tablet
- [ ] (Web only) "Open in c64-ready" link via `?game=<url>`, configurable base URL
- [ ] KickAss charset/map-viewer stub (after M7): charset, map window, colour RAM, bg/MC/ECM colours

### M6: Charset editor

- [x] 8×8 char grid editor reusing sprite canvas/input (hires / MC / ECM)
- [x] Charset palette view (16×16 grid), select/copy/paste/swap chars
- [x] New charset dialog: blank (default) or optional PETSCII starter (upper/graphics or lower case); ROM charset kept as a separate data file
- [x] Per-char colour attribute; global bg/MC1/MC2 (+ECM bg colours)
- [x] DATA panel (8 bytes) + bit headers like the Character Worksheet
- [x] Tools: flip, rotate, shift, invert, clear
- [x] Layout per the approved mock-up (Character Worksheet artboard)
- [x] Double-tap a pixel to clear it, with the draw tool; same undo step as the first tap (shared grid input, so the sprite designer gets it too)
- [x] Zen mode on every worksheet (sprites, chars, screen): full-screen grid with pinch zoom/pan, minimal tools (draw/erase/fill, undo/redo), pens, recolour a pen from the project's colours, prev/next asset, exit back to the worksheet

### M7: Charmap editor

- [x] New map: choose W×H and which project charset it uses; resize; change charset
- [x] Map canvas rendering chars with per-char colours; 40×25 viewport overlay; position/address readout (1024 + x + 40·y style)
- [x] Palette-pick placement, rectangle select/copy/paste, fill
- [x] Zoom/pan for large maps (virtualised rendering)
- [x] Live charset edits reflected in map
- [x] Blank Char per map (tool rail button + dialog), $00 by default; block brushes from a selection (CharPad-style stamping)

### M8: Exporters (chars/maps)

- [ ] Raw `.bin`: charset, map, attributes/colours
- [ ] KickAssembler source
- [ ] CharPad `.ctm` (research spec; user verifies in CharPad)
- [ ] PNG of map
- [ ] KickAss example loader (copy map to screen RAM, colours to $D800)

### M9: Desktop + later

- [ ] Electron (or Tauri) shell for Linux/Windows with native file dialogs
- [ ] Homepage polish (worksheet-styled entry tiles: Sprites / Characters / Screens)
- [ ] Portrait layouts: tablet portrait, then phone
- [ ] Printable blank worksheets (sprite, character, screen): print stylesheet and/or PDF export rendered from the editor components
- [ ] Dark mode
- [ ] Optional: CharPad tiles/blocks layer
- [ ] Publish to deployed backend (auth, server functions, sharing)
- [ ] Remote KickAssembler build service (containerised, CORS PRG URLs); "Build on server" option for custom asm templates; enables "Open in c64-ready" from app builds
- [ ] Spike: JS/wasm 6502 assembler for on-device template assembly (only if editing asm on the tablet is wanted)
