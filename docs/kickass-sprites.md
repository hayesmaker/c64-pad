# Using sprite exports in KickAssembler

C64-Pad's sprite exporter writes sprites as they sit in C64 memory: **64 bytes
per sprite** (63 bytes of pixels + 1 byte that is either zero or the SpritePad
attribute byte). Put the data on a 64-byte boundary and each sprite's pointer
is simply `address / 64`.

Both examples below were assembled with KickAssembler and produce identical
programs. They show sprite 0 of a set called "Ships" in the middle of the
screen.

## From a `.bin` export

```asm
// Show sprite 0 from a C64-Pad .bin export in the middle of the screen.
// Assemble: java -jar KickAss.jar show-bin.asm
BasicUpstart2(start)

.const SPRITES = $2000              // must be a multiple of 64
.const POINTERS = $0400 + $3f8      // sprite pointers live at the end of screen RAM

start:
        lda #SPRITES / 64           // pointer = address / 64 = $80
        sta POINTERS + 0
        lda #%00000001
        sta $d015                   // enable sprite 0
        sta $d01c                   // sprite 0 multicolour (leave out for hires)
        lda #11
        sta $d025                   // sprite multicolour 1 (shared)
        lda #1
        sta $d026                   // sprite multicolour 2 (shared)
        lda #10
        sta $d027                   // sprite 0 colour
        lda #172
        sta $d000                   // x
        lda #139
        sta $d001                   // y
        jmp *

*= SPRITES "Sprites"
        .import binary "ships.bin"
```

## From a KickAssembler (`.asm`) export

The source export defines a label for the set (`ships`), one per sprite
(`ships_0`, `ships_1`, …) and colour labels (`ships_mc1`, `ships_mc2`,
`ships_0_color`, …). They are `.label`s, so they can be used before the
`#import` line.

```asm
// Same, using the KickAssembler source export and its colour constants.
BasicUpstart2(start)

.const POINTERS = $0400 + $3f8

start:
        lda #ships / 64
        sta POINTERS + 0
        lda #%00000001
        sta $d015
        sta $d01c
        lda #ships_mc1
        sta $d025
        lda #ships_mc2
        sta $d026
        lda #ships_0_color
        sta $d027
        lda #172
        sta $d000
        lda #139
        sta $d001
        jmp *

*= $2000 "Sprites"
#import "ships.asm"
```

## Registers used

| Register          | Meaning                                          |
| ----------------- | ------------------------------------------------ |
| `$07f8–$07ff`     | Sprite pointers 0–7 (with screen RAM at `$0400`) |
| `$d000/$d001`     | Sprite 0 X / Y (`$d010` holds bit 8 of each X)   |
| `$d015`           | Sprite enable bits                               |
| `$d01c`           | Sprite multicolour bits                          |
| `$d017` / `$d01d` | Expand Y / expand X bits                         |
| `$d025` / `$d026` | Sprite multicolour 1 / 2 (shared by all sprites) |
| `$d027–$d02e`     | Sprite 0–7 colours                               |

Overlays: when two sprites overlap, the **lower-numbered sprite is drawn on
top**, so give an overlay a lower sprite number than its base.
