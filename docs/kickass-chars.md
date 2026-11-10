# Using charset and map exports in KickAssembler

C64-Pad's Character and Screen worksheets export what a C64 program uses
directly (Run & export, then Export files):

| Export                    | Bytes           | What it is                                                                                                                                                                                                                                                                                                               |
| ------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Charset `-chars.bin`      | 2048 (ECM: 512) | 8 bytes per char, as the VIC reads it. Put it on a `$800` boundary the VIC can see: in bank 0 that is `$0000`-`$3fff` except `$1000`-`$1fff`, where the VIC sees the character ROM.                                                                                                                                      |
| Charset `-colours.bin`    | 256             | Colour RAM value per screen code; multicolour chars have bit 3 set. A lookup table: `lda colours,y` with the screen code in Y. In ECM, codes 64 and up share the colour of their shape (code & 63).                                                                                                                      |
| Charset `-attributes.bin` | 256             | Attribute (0-15, 0 = none) per screen code, as set in the Character Worksheet: a lookup table for game logic (`lda attributes,y` with the screen code in Y). In ECM, codes 64 and up share their shape's attribute.                                                                                                      |
| Map `-map.bin`            | width × height  | One screen code per cell, row by row.                                                                                                                                                                                                                                                                                    |
| Map `-colours.bin`        | width × height  | Colour RAM per cell (from each char's colour), ready for `$d800`.                                                                                                                                                                                                                                                        |
| Map `-attributes.bin`     | width × height  | Attribute per cell (from each char's attribute), row by row like the map.                                                                                                                                                                                                                                                |
| KickAss `.asm`            |                 | Labels and `.byte` rows: the map's `_width`, `_height`, `_data`, optionally `_colours`, `_attributes` and the charset (`_chars` after `.align $800`, `_colours` table, `_d021`-`_d024` register values, and when any char has an attribute an `_attributes` table plus an `_attr_<name> = n` label per named attribute). |
| CharPad `.ctm`            |                 | A CharPad project (version 7): the charset with a colour and material (the attribute, high nibble of the char attribute byte) per char, no tiles, the map as char numbers. Opens in CharPad 2.8 and later.                                                                                                               |

`$d018` picks screen and charset: `((screen / $400) << 4) | ((charset / $800) << 1)`;
screen `$0400` with the charset at `$2000` is `$18`. Multicolour text is
bit 4 of `$d016`, ECM bit 6 of `$d011`.

Both examples below were assembled with KickAssembler and run in c64-ready:
screen RAM, colour RAM and the charset matched the exports byte for byte.
They show the top-left screen of a map called "Level" with a multicolour
charset called "Tiles". For a map wider than 40, copy each row from
`data + row * width`.

## From `.bin` exports

```asm
// Show a 40 x 25 map from C64-Pad .bin exports: the map (-map.bin), the
// charset (-chars.bin) and its colour table (-colours.bin).
// Assemble: java -jar KickAss.jar show-bin.asm
BasicUpstart2(start)

.const SCREEN  = $0400
.const CHARSET = $2000              // a $800 boundary in VIC bank 0, not $1000-$1fff

start:
        lda #0
        sta $d021                   // background ($D021 of the charset)
        lda #11
        sta $d022                   // multicolour 1 (multicolour mode only)
        lda #12
        sta $d023                   // multicolour 2
        lda #((SCREEN / $400) << 4) | ((CHARSET / $800) << 1)
        sta $d018                   // screen $0400, charset $2000 = $18
        lda $d016
        ora #%00010000              // multicolour text (leave out for hires)
        sta $d016

        ldx #0                      // 1000 cells in 4 strips of 250
!:
        .for (var strip = 0; strip < 4; strip++) {
        lda map + strip * 250, x
        sta SCREEN + strip * 250, x
        tay
        lda colours, y              // colour RAM value of that screen code
        sta $d800 + strip * 250, x
        }
        inx
        cpx #250
        bne !-
        jmp *

map:     .import binary "level-map.bin"       // 1000 bytes: one screen
colours: .import binary "tiles-colours.bin"   // 256 bytes: colour per code

*= CHARSET "Charset"
        .import binary "tiles-chars.bin"
```

## From the KickAssembler (`.asm`) export

```asm
// Same, from the KickAssembler export of the map ("Level", with its colour
// RAM and the "Tiles" charset). Its labels: level_data, level_colours,
// level_width, tiles_chars, tiles_d021, tiles_d022, tiles_d023.
BasicUpstart2(start)

.const SCREEN = $0400

start:
        lda #tiles_d021
        sta $d021
        lda #tiles_d022
        sta $d022
        lda #tiles_d023
        sta $d023
        lda #((SCREEN / $400) << 4) | ((tiles_chars / $800) << 1)
        sta $d018
        lda $d016
        ora #%00010000              // the export is multicolour
        sta $d016

        ldx #0
!:
        .for (var strip = 0; strip < 4; strip++) {
        lda level_data + strip * 250, x
        sta SCREEN + strip * 250, x
        lda level_colours + strip * 250, x
        sta $d800 + strip * 250, x
        }
        inx
        cpx #250
        bne !-
        jmp *

// The export starts with the map; its charset follows on the next $800
// boundary, so put it where that boundary is visible to the VIC
// ($2000 here: map $2000, colours $23e8, charset $2800).
*= $2000 "Level"
#import "level.asm"
```
