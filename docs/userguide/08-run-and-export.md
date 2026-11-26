# Run and export

[User guide](README.md) › Run and export

Every editor has a **Run & export** button in its header. It offers two
things:

- **Run on C64**: see your work on a real (emulated) C64, straight away.
- **Export files**: save the data for your own programs, other C64 tools or
  sharing.

## Run on C64

C64-Pad has a C64 emulator built in (**c64-ready**). Choose **Run on C64** and
tap **Run**: C64-Pad builds a small C64 program around your graphics and runs
it in a window over the worksheet. It works offline.

What you see depends on where you started:

| From                    | The C64 shows                                                                                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sprite Worksheet**    | The selected sprite large in the middle (with its overlay, if it has one), and the set's other sprites along the bottom. If an animation is selected, it plays, at its speed and in its play mode. |
| **Character Worksheet** | All 256 chars (or screen codes in ECM, or tiles in bitmap mode) as a 16 × 16 grid, in the charset's mode and colours.                                                                              |
| **Screen Worksheet**    | The map on the C64 screen. A bigger map starts on the part you're looking at on the worksheet, and scrolls with the **arrow keys** or the **on-screen joystick** (joystick port 2).                |

In the emulator window:

- **Save .prg** saves the program, to load in VICE or on real hardware.
- **Restart** runs it again from the start.
- **Close** (or **Esc**) goes back to the worksheet.

The emulator uses its own colour palette, so colours may look a little
different from your project's [palette](02-projects.md#colour-palette).

## Export files

Choose **Export files**, pick a format from the tabs, check the preview and
the file name and size, then tap **Save**. In a browser the file downloads;
on Android you choose where to save it.

Files are named after the project and the asset, e.g.
`My Game-Ships.bin`.

### Sprites

| Format        | What you get                                                                               |
| ------------- | ------------------------------------------------------------------------------------------ |
| **.bin**      | Raw bytes, 64 per sprite, ready for KickAssembler's `.import binary`.                      |
| **KickAss**   | KickAssembler source: labelled `.byte` rows with a picture of each row, and colour labels. |
| **SpritePad** | A SpritePad `.spd` file (version 1, which every SpritePad can read) with the whole set.    |
| **PNG**       | An image of the sprites, for sharing.                                                      |

Options:

- **Sprites**: **All**, **Current** (the selected sprite) or a **Range**
  (first to last).
- **64th byte**: each sprite is 63 bytes, padded to 64 so it sits on a
  64-byte boundary. Fill the 64th byte with **Zero pad** or with
  **SpritePad attributes** (the sprite's colour, multicolour, overlay and expand flags).
- **PNG**: the **scale**, how many **columns**, and the **background**
  (transparent or the screen colour).

SpritePad can only store an overlay on the very next sprite, and animations
as a run of neighbouring sprites (e.g. 4 to 7). Anything it can't store is
left out of the `.spd`, and the dialog tells you what.

### Charsets

| Format         | What you get                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Chars .bin** | The charset as the VIC-II reads it, 8 bytes per char (2048 bytes; 512 in ECM). Load it on a $800 boundary.                |
| **Colours**    | 256 bytes: the colour RAM value for each screen code, a lookup table for filling $D800. Multicolour chars have bit 3 set. |
| **Screen**     | Bitmap charsets only: 256 bytes of screen RAM per tile (01's colour in the high nibble, 10's in the low).                 |
| **Attributes** | 256 bytes: each screen code's [attribute](05-characters.md#char-attributes) (0 to 15), for game code.                     |
| **KickAss**    | KickAssembler source (see below).                                                                                         |
| **PNG**        | An image of the whole charset, 16 chars per row, at the scale you choose.                                                 |

### Screen maps

| Format         | What you get                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Map .bin**   | One byte per cell, row by row (width × height bytes).                                                                                             |
| **Colours**    | Colour RAM for every cell, from each char's colour. Copy a screen's worth to $D800.                                                               |
| **Screen**     | Bitmap maps only: screen RAM for every cell, including cells with their own colours.                                                              |
| **Koala**      | Bitmap maps only: a Koala Painter picture (`.kla`, 10003 bytes). On a big map, it's the screen in view.                                           |
| **Attributes** | Each cell's attribute, row by row like the map.                                                                                                   |
| **KickAss**    | KickAssembler source with the map's size and rows. Tick to include **Colour RAM per cell**, **Attributes per cell** and the **charset**.          |
| **CharPad**    | A CharPad project (`.ctm` version 7) with the charset, each char's colour and material (attribute), and this map. Opens in CharPad 2.8 and later. |
| **PNG**        | An image of the whole map.                                                                                                                        |

### KickAssembler code

The **KickAss** tab has two styles:

- **Raw bytes**: everything in one source file as `.byte` rows, with labels
  and register values (`_d021` and so on).
- **.bin imports**: a short source file that `.import`s the `.bin` files
  (save each one from its own tab), with labels and example code.

On each `.bin` tab, **Show KickAss code to import the .bin** shows the lines
to load that file, with a **Copy** button.

For worked examples of loading exports in your own program, see
[Using sprite exports in KickAssembler](../kickass-sprites.md) and
[Using charset and map exports in KickAssembler](../kickass-chars.md).

---

Previous: [Tracing paper](07-tracing-paper.md) · Next:
[Moving projects between devices](09-moving-projects.md)
