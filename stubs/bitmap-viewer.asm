// C64-Pad multicolour bitmap viewer.
//
// Assembled once by scripts/build-stubs.sh; the app fills in the CONFIG
// block, the tiles (the charset) at $4000 and the map at $4800
// (src/emulator/bitmap-viewer.ts) to make a PRG for c64-ready.
//
// The map is three arrays of MAPW x rows bytes: tile per cell, then screen
// RAM per cell (colours of 01 and 10), then colour RAM per cell (11). A
// window of it is drawn into the bitmap at $2000, tile by tile; maps bigger
// than the screen start at STARTX, STARTY and scroll a cell at a time with
// joystick port 2.
//
// Keep these addresses in sync with src/emulator/bitmap-viewer.ts.

.const CONFIG   = $0c00
.const BORDER   = CONFIG + 0
.const BG       = CONFIG + 1        // $d021
.const MAPW     = CONFIG + 2        // word: map width (bytes per map row)
.const VIEWW    = CONFIG + 4        // columns shown (1-40)
.const VIEWH    = CONFIG + 5        // rows shown (1-25)
.const MAXSX    = CONFIG + 6        // word: largest scroll column
.const MAXSY    = CONFIG + 8        // word: largest scroll row
.const STARTX   = CONFIG + 10       // word: scroll column to start at
.const STARTY   = CONFIG + 12       // word: scroll row to start at
.const SCROFF   = CONFIG + 14       // word: screen RAM array - MAP
.const COLOFF   = CONFIG + 16       // word: colour RAM array - MAP
.const SCRAT    = CONFIG + 18       // word: screen address of the window
.const BMPAT    = CONFIG + 20       // word: bitmap address of the window
.const TILES    = $4000             // 2 KB: 8 bytes per tile
.const MAP      = $4800             // the three arrays, up to $cfff
.const SCREEN   = $0400             // screen RAM; $d018 = $18
.const BITMAP   = $2000

.const src      = $10               // zero page pointers (BASIC's; unused)
.const scr      = $12
.const col      = $14
.const dst      = $16
.const dcol     = $18
.const bmp      = $1a
.const tile     = $1c
.const prod     = $1e
.const bmprow   = $20

BasicUpstart2(start)

* = $0810 "Viewer"
start:
        sei
        lda #$7f
        sta $dc0d                   // no CIA interrupts: we own the machine
        lda $dc0d
        lda #$36                    // BASIC ROM out: the map may lie under it
        sta $01
        lda BORDER
        sta $d020
        lda BG
        sta $d021
        lda #$18                    // screen $0400, bitmap $2000
        sta $d018
        lda #$3b                    // bitmap mode
        sta $d011
        lda #$d8                    // multicolour
        sta $d016

        lda #<BITMAP                // clear the bitmap: background everywhere
        sta dst
        lda #>BITMAP
        sta dst + 1
        lda #0
        ldx #$20                    // $2000-$3fff
        ldy #0
!:      sta (dst), y
        iny
        bne !-
        inc dst + 1
        dex
        bne !-

        lda STARTX                  // start where the editor was looking
        sta sx
        lda STARTX + 1
        sta sx + 1
        lda STARTY
        sta sy
        lda STARTY + 1
        sta sy + 1
        lda #0
        sta delay
        jsr draw

mainloop:
!:      lda $d012                   // once per frame
        cmp #250
        bne !-
!:      lda $d012
        cmp #250
        beq !-
        lda delay
        beq !+
        dec delay
        jmp mainloop
!:      lda $dc00                   // joystick port 2, active low
        eor #$ff
        and #$0f
        beq mainloop
        sta joy
        lsr joy                     // bit 0: up
        bcc !+
        jsr up
!:      lsr joy                     // bit 1: down
        bcc !+
        jsr down
!:      lsr joy                     // bit 2: left
        bcc !+
        jsr left
!:      lsr joy                     // bit 3: right
        bcc !+
        jsr right
!:      jsr draw                    // drawing takes several frames itself
        jmp mainloop

up:     lda sy                      // sy > 0: sy--
        ora sy + 1
        beq !+
        lda sy
        bne !dec+
        dec sy + 1
!dec:   dec sy
!:      rts

down:   lda sy + 1                  // sy < MAXSY: sy++
        cmp MAXSY + 1
        bcc !inc+
        bne !+
        lda sy
        cmp MAXSY
        bcs !+
!inc:   inc sy
        bne !+
        inc sy + 1
!:      rts

left:   lda sx
        ora sx + 1
        beq !+
        lda sx
        bne !dec+
        dec sx + 1
!dec:   dec sx
!:      rts

right:  lda sx + 1
        cmp MAXSX + 1
        bcc !inc+
        bne !+
        lda sx
        cmp MAXSX
        bcs !+
!inc:   inc sx
        bne !+
        inc sx + 1
!:      rts

// Draw the window at (sx, sy): each cell's tile into the bitmap, its
// colours into screen and colour RAM.
draw:   lda #0                      // prod = sy * MAPW (16 bit)
        sta prod
        sta prod + 1
        lda sy
        sta m1
        lda sy + 1
        sta m1 + 1
        ldx #16
!:      asl prod
        rol prod + 1
        asl m1
        rol m1 + 1
        bcc !skip+
        clc
        lda prod
        adc MAPW
        sta prod
        lda prod + 1
        adc MAPW + 1
        sta prod + 1
!skip:  dex
        bne !-
        clc                         // src = MAP + prod + sx
        lda prod
        adc sx
        sta prod
        lda prod + 1
        adc sx + 1
        sta prod + 1
        clc
        lda prod
        adc #<MAP
        sta src
        lda prod + 1
        adc #>MAP
        sta src + 1
        clc                         // scr = src + SCROFF, col = src + COLOFF
        lda src
        adc SCROFF
        sta scr
        lda src + 1
        adc SCROFF + 1
        sta scr + 1
        clc
        lda src
        adc COLOFF
        sta col
        lda src + 1
        adc COLOFF + 1
        sta col + 1
        lda SCRAT                   // dst = window on screen, dcol in $d800
        sta dst
        sta dcol
        lda SCRAT + 1
        sta dst + 1
        clc
        adc #>($d800 - SCREEN)
        sta dcol + 1
        lda BMPAT
        sta bmprow
        lda BMPAT + 1
        sta bmprow + 1
        lda VIEWH
        sta rows
rowloop:
        lda bmprow
        sta bmp
        lda bmprow + 1
        sta bmp + 1
        lda #0
        sta column
cell:   ldy column
        lda (scr), y
        sta (dst), y
        lda (col), y
        sta (dcol), y
        lda (src), y                // tile = TILES + code * 8
        ldx #0
        stx tile + 1
        asl
        rol tile + 1
        asl
        rol tile + 1
        asl
        rol tile + 1
        sta tile
        lda tile + 1
        clc
        adc #>TILES
        sta tile + 1
        ldy #7
!:      lda (tile), y
        sta (bmp), y
        dey
        bpl !-
        clc                         // next cell of the bitmap
        lda bmp
        adc #8
        sta bmp
        bcc !+
        inc bmp + 1
!:      inc column
        lda column
        cmp VIEWW
        bne cell
        jsr nextrow                 // next map row, in all three arrays
        clc                         // next screen row
        lda dst
        adc #40
        sta dst
        sta dcol
        bcc !+
        inc dst + 1
        inc dcol + 1
!:      clc                         // next bitmap row: 320 bytes on
        lda bmprow
        adc #<320
        sta bmprow
        lda bmprow + 1
        adc #>320
        sta bmprow + 1
        dec rows
        beq !+
        jmp rowloop
!:      rts

nextrow:
        clc
        lda src
        adc MAPW
        sta src
        lda src + 1
        adc MAPW + 1
        sta src + 1
        clc
        lda scr
        adc MAPW
        sta scr
        lda scr + 1
        adc MAPW + 1
        sta scr + 1
        clc
        lda col
        adc MAPW
        sta col
        lda col + 1
        adc MAPW + 1
        sta col + 1
        rts

sx:     .word 0
sy:     .word 0
m1:     .word 0
rows:   .byte 0
column: .byte 0
joy:    .byte 0
delay:  .byte 0

.assert "viewer code must end before CONFIG", * <= CONFIG, true
