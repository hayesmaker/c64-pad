# Tracing paper

[User guide](README.md) › Tracing paper

**Tracing paper** puts a reference image under (or over) the grid, so you can
trace a sketch, a mock-up from a paint program, or a screenshot. It works on
the **Sprite Worksheet** and the **Screen Worksheet**, and the **Character
Worksheet** can borrow a screen's tracing for each char.

Tracing images stay **on this device**. They aren't part of the project, so
they aren't in exported `.c64pad` files, cloud copies or any other export.

## Adding tracing paper

1. Open a sprite or a screen map and tap **Tracing paper** in the header.
   Its settings take the place of the left panel.
2. Tap **Choose a reference image** and pick a PNG, JPEG, GIF or WebP.
3. Line it up with the settings below, then tap **Done**.

Each sprite and each map has its own tracing paper. The **eye** button beside
Tracing paper shows or hides it while you draw.

## Lining it up

The panel says how the image compares with the sprite or map (e.g. "the
image is 16 px wider"), so you know what to adjust.

| Setting     | What it does                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Crop**    | Trims pixels off each edge of the image.                                                                                                                            |
| **Size**    | **1:1** (one image pixel per C64 pixel), **Fit width**, **Fit height**, **Fit all**, **Stretch**, or **Custom** (a percentage).                                     |
| **Anchor**  | Which of nine points (corners, edges, centre) the image is pinned to.                                                                                               |
| **Nudge**   | Moves the image by C64 pixels, across and down. 8 pixels is one char.                                                                                               |
| **Opacity** | How strongly the image shows.                                                                                                                                       |
| **Layer**   | **Over all** draws it over your drawing; **Under empty** shows it only where nothing is drawn yet (transparent sprite pixels, or map cells holding the Blank Char). |

The image is drawn with sharp pixels, so a 1:1 image lines up exactly with
the grid.

**Replace** swaps in another image and keeps the settings; **Remove tracing
paper** takes it away.

On a big map the [Navigator](06-screens.md#getting-around-a-big-map) shows the
tracing too.

## Tracing chars

Drawing a screen usually means drawing its chars. Once a screen has tracing
paper, the **Character Worksheet** shows the piece of that image under one
map cell, right on the 8 × 8 grid, so you can draw the char to match. Nothing
is copied: move or replace the screen's image and the chars follow.

The **Tracing from screens** panel on the Character Worksheet picks the cell:

- If the char has a **pin** (see below), it shows the pinned cell, with
  **Remove pin** to clear it.
- Otherwise it steps through **each place the char is painted** on a traced
  screen using this charset. Use **‹** and **›** to move between places, and
  **Pin here** to pin the one you want.

You can also set the char tracing's **opacity**, choose **Over all** or
**Under empty**, and hide or show it.

### Pinning chars before you draw them

A new char isn't on any screen yet, so there's nothing to trace. Pin it to
where it belongs first:

1. On the Screen Worksheet, choose the char as your brush.
2. Choose the **Pin** tool and tap the cell where the char goes. A toast
   confirms the pin. With a block brush, each of its chars is pinned to its
   own cell.
3. Switch to **CHARS**: the char's tracing shows the image under that cell.

The Pin tool needs the screen to have tracing paper first. Pins, opacity and
the over / under setting are kept per charset on this device.

---

Previous: [Screens](06-screens.md) · Next: [Run and export](08-run-and-export.md)
