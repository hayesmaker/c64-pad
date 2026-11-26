# C64 graphics basics

[User guide](README.md) › C64 graphics basics

You don't need to know any of this to use C64-Pad: the worksheets keep you
inside the rules. But knowing _why_ the rules exist makes it much easier to
plan good-looking graphics.

## The screen

The C64's graphics chip, the **VIC-II**, shows a screen of **320 × 200**
pixels, laid out as **40 × 25** cells of 8 × 8 pixels. Instead of storing
every pixel, most games store one byte per cell: a **screen code** saying
which of 256 **characters** goes there. That's 1000 bytes for a whole screen
instead of 8000.

Around the screen is a **border** in a colour of its own.

## 16 colours

The C64 has a fixed palette of 16 colours, numbered 0 to 15:

| #   | Colour | #   | Colour | #   | Colour    | #   | Colour      |
| --- | ------ | --- | ------ | --- | --------- | --- | ----------- |
| 0   | Black  | 4   | Purple | 8   | Orange    | 12  | Grey        |
| 1   | White  | 5   | Green  | 9   | Brown     | 13  | Light Green |
| 2   | Red    | 6   | Blue   | 10  | Light Red | 14  | Light Blue  |
| 3   | Cyan   | 7   | Yellow | 11  | Dark Grey | 15  | Light Grey  |

The hard part isn't the number of colours but **where** each colour can go.

## Hires and multicolour

Every kind of C64 graphics comes in two flavours:

- **Hires**: every pixel is one bit, so each pixel is either "off"
  (background) or "on" (one colour). Sharp, but only two colours per 8 × 8
  cell or sprite.
- **Multicolour**: pixels are paired up, so each pixel is **two bits** and
  **twice as wide**. Four colours, at half the horizontal detail. The two
  bits pick the colour: `00`, `01`, `10` or `11`.

This is why the multicolour grids in C64-Pad have wide pixels, and why the
pens are labelled with bit patterns.

## Where colours come from

Some colours are shared by the whole screen, set once in a chip register.
Others belong to one cell, one char or one sprite.

| Colour                      | Shared by         | Register / memory      |
| --------------------------- | ----------------- | ---------------------- |
| Screen background           | the whole screen  | $D021                  |
| Char multicolours 1 and 2   | the whole screen  | $D022, $D023           |
| ECM backgrounds 1 to 3      | the whole screen  | $D022 to $D024         |
| A cell's own colour         | one screen cell   | colour RAM, from $D800 |
| Sprite multicolours 1 and 2 | all eight sprites | $D025, $D026           |
| A sprite's own colour       | one sprite        | $D027 to $D02E         |

**Colour RAM** holds one colour per screen cell. C64-Pad treats it as a
property of each char (a char always has the same colour wherever it's
placed), which is how most games use it, and exports the per-char colours as
a lookup table.

## Characters and charsets

A **charset** is 256 chars of 8 bytes each: 2 KB. Each byte is one row, and
each bit is one pixel, with the left-most pixel worth 128 and the right-most
worth 1. That's what the **bit headers** above the grid show.

The VIC-II reads a charset from any 2 KB ($800) boundary it can see, so you
can replace the built-in letters with your own drawings. The C64's built-in
set is called **PETSCII**.

## Sprites

A sprite is **24 × 21** pixels: 3 bytes across × 21 rows = 63 bytes, padded
to 64 so each sprite starts on a 64-byte boundary. The VIC-II finds a sprite
through its **pointer**, the sprite's address divided by 64.

Eight sprites can be on screen at once, each anywhere, each with its own
colour, and each can be stretched to double width (**expand X**) or double
height (**expand Y**). All multicolour sprites share the same two
multicolours.

## Glossary

| Term               | Meaning                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------ |
| **Bitmap mode**    | Every pixel stored directly (8000 bytes). C64-Pad builds multicolour bitmaps from tiles.   |
| **Blank Char**     | The char a map treats as empty: what Erase writes and what new cells get.                  |
| **Block brush**    | A rectangle of chars painted as one on the Screen Worksheet.                               |
| **Char**           | One 8 × 8 character.                                                                       |
| **Char attribute** | A number 0 to 15 per char for game code (solid, ladder…); CharPad calls them materials.    |
| **Charset**        | A set of 256 chars.                                                                        |
| **Colour RAM**     | One colour per screen cell, at $D800.                                                      |
| **ECM**            | Extended colour mode: 64 chars, each cell on one of four backgrounds.                      |
| **Hires**          | One bit per pixel: full resolution, two colours.                                           |
| **KickAssembler**  | A popular 6502 cross-assembler; C64-Pad's source exports use its syntax.                   |
| **Koala**          | Koala Painter, a classic C64 paint program; its `.kla` files are a standard bitmap format. |
| **Multicolour**    | Two bits per pixel: double-wide pixels, four colours.                                      |
| **Overlay**        | A hires sprite drawn over a multicolour sprite to add detail.                              |
| **PAL frame**      | 1/50 of a second, one screen refresh on a European C64. Animation speeds count these.      |
| **PETSCII**        | The C64's built-in character set.                                                          |
| **.prg**           | A C64 program file, loadable in emulators such as VICE or on real hardware.                |
| **Screen code**    | The byte in a screen cell that says which char to show.                                    |
| **Screen RAM**     | The 1000 screen codes of the visible screen, at 1024 ($0400) by default.                   |
| **Sprite pointer** | Where a sprite's data is: its address ÷ 64.                                                |
| **VIC-II**         | The C64's graphics chip.                                                                   |

---

Previous: [Moving projects between devices](09-moving-projects.md) · Back to
the [contents](README.md)
