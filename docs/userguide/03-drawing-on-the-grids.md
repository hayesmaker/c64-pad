# Drawing on the grids

[User guide](README.md) › Drawing on the grids

The Sprite and Character Worksheets share the same pixel grid, tools and
gestures. The Screen Worksheet works the same way for zooming and panning,
with its own map tools (see [Screens](06-screens.md)).

## The tool rail

The column of buttons beside the grid, top to bottom:

| Icon               | Tool                               | What it does                                                                                               |
| ------------------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Pencil             | **Draw**                           | Paints with the selected pen. **Double-tap** a pixel to clear it again (both taps count as one undo step). |
| Eraser             | **Erase**                          | Paints with the background / transparent pen.                                                              |
| Paint pot          | **Fill**                           | Fills the area of same-coloured pixels you tap.                                                            |
| Hand               | **Hand**                           | Drags the view around instead of drawing. Pinching picks it for you (see below).                           |
| Mirrored triangles | **Flip horizontally / vertically** | Mirrors the sprite or char.                                                                                |
| Turning arrow      | **Rotate clockwise**               | Characters only, and only hires chars (multicolour pixels are two wide, so they can't turn).               |
| Four arrows        | **Shift**                          | Opens a menu: up, down, left or right one step. Pixels that fall off one edge come back on the other.      |
| Half-filled circle | **Invert**                         | Swaps set and clear pixels.                                                                                |
| Bin                | **Clear sprite / character**       | Empties the whole sprite or char (you can undo it).                                                        |
| `1×`               | **Zoom**                           | At 1× it zooms in to 2×; when zoomed, it goes back to 1×.                                                  |

On small screens the less-used tools fold into a **More tools** button.

## Pens

The **Pens** panel shows the colours this sprite or char can use, labelled
with the bit pattern each stands for:

- **Hires** (single colour) has two pens: the background or transparent pen,
  and one colour.
- **Multicolour** has four pens, `00`, `01`, `10` and `11`. Pixels are two
  wide.

Pick a pen, then pick a colour from the 16-colour grid below to recolour it.
Each pen says where its colour lives: just this sprite or char, shared by the
whole set, or a register for the whole screen. Changing a shared colour
changes it everywhere it's used. The details are on the
[Sprites](04-sprites.md#pens-and-colours) and
[Characters](05-characters.md#pens-and-colours) pages.

## Touch, stylus and mouse

- **One finger, stylus or mouse** draws. Strokes are gap-free, however fast
  you move.
- **Palm rejection**: while you draw with a stylus, other touches are
  ignored, so you can rest your hand on the screen.
- **A second finger** cancels the stroke in progress, so starting a pinch
  never leaves a stray line.
- **Pinch** to zoom (1× to 8×) and **drag with two fingers** to pan. Pinching
  switches to the **Hand** tool, so lifting your fingers doesn't paint; tap
  **Draw** to go back to drawing.
- **Mouse wheel** zooms around the pointer. **Shift + wheel** pans sideways
  and **Alt + wheel** pans up and down.

The bit headers (`128 64 32 … 1`) and row numbers follow the grid as you
zoom and pan.

## The DATA column

Beside the grid, the **DATA** column shows the bytes your drawing makes, one
row at a time, exactly as the C64 stores them. It updates as you draw.

**Tap the DATA column** to switch between decimal and hex.

## Undo and redo

Every worksheet has **Undo** and **Redo** in its header. A whole stroke is one
step, however long. On a keyboard:

| Keys                   | Action |
| ---------------------- | ------ |
| Ctrl+Z (⌘Z on a Mac)   | Undo   |
| Ctrl+Y or Ctrl+Shift+Z | Redo   |

The shortcuts don't fire while you're typing in a text field.

## Zen mode

**Zen mode** (in each worksheet's header) hides everything but the grid, for
drawing with no distractions. It fills the screen and keeps just what you
need:

- **Draw**, **Erase**, **Fill** and **Hand**, plus **Undo** and **Redo**.
- **Zoom out**, **Reset zoom** and **Zoom in** (pinch and two-finger pan work
  too).
- The **pens**, and the **project colours** to recolour the selected pen.
- **Previous** and **Next** to step to the neighbouring sprite, char or
  screen without leaving Zen mode.

Leave with the **Leave Zen mode** button or **Esc**. Zen mode works on all three
worksheets; on the Screen Worksheet you paint with the current brush.

## Gamepad

A connected gamepad can drive the sprite and char grids. Press **Start** to
show or hide this list on screen.

| Button        | Action                         |
| ------------- | ------------------------------ |
| D-pad / stick | Move the cursor                |
| A             | Paint (hold and move to draw)  |
| B             | Switch between Draw and Erase  |
| X             | Switch between Draw and Fill   |
| L1 / R1       | Previous / next pen            |
| Y + L1 / R1   | Previous / next sprite or char |
| L2 / R2       | Undo / redo                    |
| Select        | Zen mode on / off              |
| Start         | Show / hide these controls     |

## Small screens

On screens up to 600 pixels tall or 700 wide (handhelds, phones, small
windows), the worksheets switch to a **compact layout**:

- The side panel becomes a **drawer**, opened from a header button
  (**Sprite details**, **Character details** or **Map settings**) and closed
  by tapping outside it.
- The DATA column is hidden until you tap **Show data bytes**.
- Less-used tools fold into **More tools**.

Everything else works as on a tablet.

---

Previous: [Projects](02-projects.md) · Next: [Sprites](04-sprites.md)
