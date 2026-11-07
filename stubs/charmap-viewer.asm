// C64-Pad charset / map viewer.
//
// Assembled once by scripts/build-stubs.sh; the app fills in the CONFIG block,
// the colour table, the charset at $2000 and the map at $2800
// (src/emulator/charmap-viewer.ts) to make a PRG for c64-ready.
//
// Shows a window of the map in the charset's mode (hires, multicolour or
// ECM). Maps bigger than the screen scroll a char at a time with joystick
// port 2.
//
// Keep these addresses in sync with src/emulator/charmap-viewer.ts.

.const CONFIG   = $0c00
.const BORDER   = CONFIG + 0
.const BG       = CONFIG + 1        // $d021
.const D022     = CONFIG + 2
.const D023     = CONFIG + 3
.const D024     = CONFIG + 4
.const MODE     = CONFIG + 5        // 0 hires, 1 multicolour, 2 ECM
.const MAPW     = CONFIG + 6        // word: map width (bytes per map row)
.const VIEWW    = CONFIG + 10       // columns shown (1-40)
.const VIEWH    = CONFIG + 11       // rows shown (1-25)
.const OFFX     = CONFIG + 12       // screen column of the window
.const OFFY     = CONFIG + 13       // screen row of the window
.const MAXSX    = CONFIG + 14       // word: largest scroll column
.const MAXSY    = CONFIG + 16       // word: largest scroll row
.const FILLCODE = CONFIG + 18       // screen code outside the window
.const FILLCOL  = CONFIG + 19       // its colour RAM value
.const COLOURS  = $0d00             // [256] colour RAM value per screen code
.const CHARSET  = $2000             // 2 KB; $d018 = $18
.const MAP      = $2800             // the map, row by row, up to $cfff
.const SCREEN   = $0400

.const src      = $f7               // zero page pointers
.const dst      = $f9
.const col      = $fb
.const prod     = $fd

BasicUpstart2(start)

* = $0810 "Viewer"
start:
        sei
        lda #$7f
        sta $dc0d                   // no CIA interrupts: we own the machine
        lda $dc0d
        lda BORDER
        sta $d020
        lda BG
        sta $d021
        lda D022
        sta $d022
        lda D023
        sta $d023
        lda D024
        sta $d024
        lda #$18                    // screen $0400, charset $2000
        sta $d018
        ldx MODE
        lda #$1b
        cpx #2
        bne !+
        ora #$40                    // ECM
!:      sta $d011
        lda #$c8
        cpx #1
        bne !+
        ora #$10                    // multicolour text
!:      sta $d016

        ldx #0                      // fill the screen around the window
!:      lda FILLCODE
        sta SCREEN, x
        sta SCREEN + $100, x
        sta SCREEN + $200, x
        sta SCREEN + $2e8, x
        lda FILLCOL
        sta $d800, x
        sta $d900, x
        sta $da00, x
        sta $dae8, x
        inx
        bne !-

        lda #0
        sta sx
        sta sx + 1
        sta sy
        sta sy + 1
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
!:      jsr draw
        lda #2                      // move every third frame
        sta delay
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

// Copy the window at (sx, sy) to the screen, colours from the table.
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
        adc #<MAP
        sta src
        lda prod + 1
        adc #>MAP
        sta src + 1
        clc
        lda src
        adc sx
        sta src
        lda src + 1
        adc sx + 1
        sta src + 1
        ldx OFFY                    // dst = screen row OFFY + OFFX
        clc
        lda rowlo, x
        adc OFFX
        sta dst
        sta col
        lda rowhi, x
        adc #0
        sta dst + 1
        clc
        adc #>($d800 - SCREEN)
        sta col + 1
        lda VIEWH
        sta rows
rowloop:
        ldy #0
!:      lda (src), y
        sta (dst), y
        tax
        lda COLOURS, x
        sta (col), y
        iny
        cpy VIEWW
        bne !-
        clc                         // next map row
        lda src
        adc MAPW
        sta src
        lda src + 1
        adc MAPW + 1
        sta src + 1
        clc                         // next screen row
        lda dst
        adc #40
        sta dst
        sta col
        bcc !+
        inc dst + 1
        inc col + 1
!:      dec rows
        bne rowloop
        rts

rowlo:  .fill 25, <(SCREEN + i * 40)
rowhi:  .fill 25, >(SCREEN + i * 40)

sx:     .word 0
sy:     .word 0
m1:     .word 0
rows:   .byte 0
joy:    .byte 0
delay:  .byte 0

.assert "viewer code must end before CONFIG", * <= CONFIG, true
