# C64-Pad

### Goal:

To Create a cross platform multi view editor for creating Commodore 64 graphics. Primary editing surfaces should be a "Sprite designer", a "Character designer" and a "Charmap designer".
Android tablet support should be its primary focus, as I want to create C64 graphics on Android tablet. Ultimately, designs and sprites can be loaded directly in our own Assembly programs using
my open source web based emulator: "c64-ready".

### Plan notes

- This applicaiton will be web based, and bundled as an android app using Capacitor, bundled as a Linux / Windows app as an Electron (or similar) app.

- Projects and designs will be savable locally or published to a future deployed environment.

- I have added some photos of a paper based Sprites, Characters and Screens worksheets for creating these by hand on paper (find at ./art/designs/). Our app editors can loosely be modelled on these.

- The editor pages should limit the user with the boundaries of C64 colour, pixel and screen modes. So a knowledge of these will be necessary.

- Designs should have export options, but we can start with something simple then add options later. A simple output of Screen could be the same as Charpad (a windows only C64 character map and charset editor). These axport as binary files importable via asm. I'll need to provide examples if llm's struggle to get these themselves.

### Sitemap

- Homepage
- My Projects
- Charset editor
- Charmap editor
- Sprite designer

---

## Decisions (agreed 2026-11-06)

| Area         | Decision                                                                                                                                                                                                               |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MVP          | **Sprite designer** first; charset editor, then charmap editor                                                                                                                                                         |
| Visual style | **Worksheet-inspired**: clean paper-like layout echoing the Sketch & Design sheets (bit-weight headers `128 64 … 1`, row numbers, live DATA byte column, labelled fields: name, program, number, date designed, notes) |
| Input        | **Stylus and finger** equally: pointer events, pinch-zoom / two-finger pan, palm rejection, large touch targets                                                                                                        |
| Storage (v1) | **IndexedDB autosave** + explicit project file export/import (`.c64pad` JSON). Publishing to a server is a later phase                                                                                                 |
| Build mode   | TanStack Start in **SPA/static mode** so Capacitor/Electron can bundle static assets; server functions only later for publishing                                                                                       |
| Packaging    | **Capacitor Android early** (milestone 1), Electron later                                                                                                                                                              |
| Assembler    | **KickAssembler** syntax for ASM exports & example loaders                                                                                                                                                             |
| c64-ready    | **"Run in c64-ready" button**: launches c64-ready with a generated stub program that displays the sprite/screen                                                                                                        |
| Engineering  | Vitest (esp. encoders), GitHub Actions CI, undo/redo command architecture from day one, todo list → GitHub Issues/Milestones                                                                                           |
| File formats | Implement from public specs (SpritePad `.spd`, CharPad `.ctm`); user verifies against real tools                                                                                                                       |

### Project model (project-first)

- A **project** is the unit of saving, listing and export. It holds **one or more** of each asset:
  - **Sprite sets**: an ordered list of sprites sharing MC1/MC2 (hardware shares these across all sprites). Animations and overlay links live inside a set.
  - **Charsets**: 256 chars (64 in ECM), mode, per-char colour attribute, bg/MC1/MC2 (+ECM bg1–3).
  - **Maps**: W×H char indices, each map references one charset in the same project.
- Project metadata mirrors the worksheets: name, program, date designed, notes. Each asset also has name + notes.
- Editors are scoped to an asset: `/projects/$projectId/sprites/$setId`, `/charsets/$charsetId`, `/maps/$mapId`. The project page lists all assets with thumbnails and "add new".
- Deleting a charset that a map uses must be blocked or prompt to reassign.

### Sprite designer scope

- Hires (24×21, 1bpp) and multicolour (12×21 double-wide pixels; bit pairs 00 bg / 01 MC1 / 10 sprite colour / 11 MC2)
- Shared MC1/MC2 per **sprite set** (as on hardware, $D025/$D026), per-sprite colour
- Animation frames with looping preview + adjustable speed
- Overlay sprites (hires over multicolour) with combined preview
- X/Y expand preview
- Exports: raw `.bin` (64 bytes/sprite), KickAss `.byte` source, SpritePad `.spd`, PNG

### Charset / charmap scope

- Modes: hires text, multicolour text (colour-RAM bit 3 selects MC per cell, so per-char colour must be 8–15 to be MC), ECM (64 chars, 4 bg colours)
- Map size: **arbitrary W×H** (Charpad-style) with a 40×25 viewport indicator; no tile/block layer in v1
- Colouring: **per char** (colour RAM is a lookup of char attributes)
- Placement: palette-pick only (no keyboard typing)
- New charset: **blank** (default) or **optional PETSCII starter** (uppercase/graphics or lowercase set from the C64 character ROM). The ROM is Commodore copyright (rights now held by Cloanto), as most C64 tools bundle it; c64-ready already ships ROMs. Keep it as a separate data file so it can be swapped or dropped if needed.
- Exports: raw charset `.bin`, map `.bin`, char attribute/colour `.bin`, KickAss source, CharPad `.ctm`, PNG

### c64-ready integration (resolved; modelled on `~/Homespace/thrust-c64/packages/level-editor`)

- **Primary: embedded player.** Depend on the `c64-ready` npm package and run a PRG in-page:
  `new C64Player({ wasmUrl, gameUrl: 'null', gameData: prg, gameType: 'prg', renderer: new CanvasRenderer(canvas), audio: { workletUrl } })` then `await player.start()`.
  Copy c64-ready's runtime assets (`c64.wasm`, audio worklet; resolved via `c64-ready/wasm`) into our static build (e.g. `/c64/`). Works offline in Capacitor.
- **Secondary: "Open in c64-ready" link.** `https://hayesmaker.github.io/c64-ready/?game=<prg url>` (base URL configurable). Needs the PRG at a CORS-enabled URL, so it's for web / the future publish backend only.
- **PRG generation without a server:** thrust assembles with KickAssembler server-side; we can't on Android. Instead, write KickAss **viewer stubs** (sprite viewer, charset/map viewer) assembled at dev time and committed as binaries + a JSON of data offsets/labels. At runtime, TS patches our bytes (sprite data, colours, pointers, charset, map, colour RAM) into the stub to produce a PRG. Stub source lives in the repo so it can be rebuilt with `KICKASS=… ./build-stubs.sh`.
- **Later options for app builds** (not v1):
  - _Remote compile server_: real KickAssembler in a container behind an API (as thrust-c64's `server/api.ts`), returning a CORS-served PRG. Enables custom/user templates and the `?game=` link from apps. Natural fit with the publish backend phase. Requires network.
  - _Ship asm templates + on-device assembly_: only worthwhile if users should edit asm on the tablet; needs a JS/wasm 6502 assembler (KickAss itself is Java and its syntax is hard to replicate).
  - The offline patch path remains the fallback either way.

### Open questions

- None currently.
