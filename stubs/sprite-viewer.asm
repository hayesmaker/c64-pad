// C64-Pad sprite viewer.
//
// Assembled once by scripts/build-stubs.sh; the app fills in the CONFIG block
// and the sprite data area at $2000 (src/emulator/sprite-viewer.ts) to make a
// PRG for c64-ready. Up to 8 hardware sprite slots, each with its own
// position and animation (a list of frames: pointer, colour, attributes).
//
// Keep these addresses in sync with src/emulator/sprite-viewer.ts.

.const CONFIG   = $0c00
.const BORDER   = CONFIG + 0
.const BG       = CONFIG + 1
.const MC1      = CONFIG + 2
.const MC2      = CONFIG + 3
.const ENABLE   = CONFIG + 4        // bit per slot
.const XLO      = CONFIG + 5        // [8]
.const XMSB     = CONFIG + 13       // bit per slot (x >= 256)
.const YPOS     = CONFIG + 14       // [8]
.const FCOUNT   = CONFIG + 22       // [8] frames per slot, 1-32
.const DELAY    = CONFIG + 30       // [8] display frames per step, 1-255
.const MODE     = CONFIG + 38       // [8] 0 loop, 1 ping-pong
.const FPTR     = CONFIG + $40      // [8*32] sprite pointer per frame
.const FCOL     = CONFIG + $140     // [8*32] colour per frame
.const FATTR    = CONFIG + $240     // [8*32] bit 0 multicolour, 1 expand X, 2 expand Y
.const CAPTION  = CONFIG + $340     // 40 screen codes, top row
.const CAPCOL   = CONFIG + $368     // caption colour
.const SPRITES  = $2000             // sprite data; pointer = $80 + index

.const FRAME    = $0f80             // runtime state (not in the PRG)
.const TIMER    = $0f88
.const DIR      = $0f90
.const SCREEN   = $0400
.const mcbits   = $fb
.const exbits   = $fc
.const eybits   = $fd

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
        lda MC1
        sta $d025
        lda MC2
        sta $d026

        ldx #0                      // clear the screen, colour RAM = caption colour
!:      lda #$20
        sta SCREEN, x
        sta SCREEN + $100, x
        sta SCREEN + $200, x
        sta SCREEN + $2e8, x
        lda CAPCOL
        sta $d800, x
        sta $d900, x
        sta $da00, x
        sta $dae8, x
        inx
        bne !-

        ldx #39                     // caption on the top row
!:      lda CAPTION, x
        sta SCREEN, x
        dex
        bpl !-

        ldx #0                      // positions and animation state
!:      txa
        asl
        tay
        lda XLO, x
        sta $d000, y
        lda YPOS, x
        sta $d001, y
        lda #0
        sta FRAME, x
        sta DIR, x
        lda DELAY, x
        sta TIMER, x
        inx
        cpx #8
        bne !-
        lda XMSB
        sta $d010
        lda #0
        sta $d01b                   // sprites in front of the screen
        jsr apply
        lda ENABLE
        sta $d015

mainloop:
!:      lda $d012                   // once per frame, at raster line 250
        cmp #250
        bne !-
        jsr tick
        jsr apply
!:      lda $d012
        cmp #250
        beq !-
        jmp mainloop

// Advance each slot's animation timer and frame.
tick:
        ldx #7
tloop:  lda FCOUNT, x
        cmp #2
        bcc tnext                   // 0 or 1 frames: nothing to animate
        dec TIMER, x
        bne tnext
        lda DELAY, x
        sta TIMER, x
        lda MODE, x
        bne pingpong
        inc FRAME, x                // loop
        lda FRAME, x
        cmp FCOUNT, x
        bcc tnext
        lda #0
        sta FRAME, x
        jmp tnext
pingpong:
        lda DIR, x
        bne back
        inc FRAME, x                // forwards until the last frame
        ldy FCOUNT, x
        dey
        tya
        cmp FRAME, x
        bne tnext
        lda #1
        sta DIR, x
        jmp tnext
back:   dec FRAME, x                // backwards until the first frame
        bne tnext
        lda #0
        sta DIR, x
tnext:  dex
        bpl tloop
        rts

// Show each slot's current frame: pointer, colour and attribute bits.
apply:
        lda #0
        sta mcbits
        sta exbits
        sta eybits
        ldx #7
aloop:  txa
        asl
        asl
        asl
        asl
        asl                         // slot * 32
        clc
        adc FRAME, x
        tay
        lda FPTR, y
        sta SCREEN + $3f8, x
        lda FCOL, y
        sta $d027, x
        lda FATTR, y
        lsr
        rol mcbits                  // slot 7 ends in bit 7, slot 0 in bit 0
        lsr
        rol exbits
        lsr
        rol eybits
        dex
        bpl aloop
        lda mcbits
        sta $d01c
        lda exbits
        sta $d01d
        lda eybits
        sta $d017
        rts

.assert "viewer code must end before CONFIG", * <= CONFIG, true
