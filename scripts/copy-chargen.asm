// Copies the character ROM ($D000-$DFFF) to RAM at $4000 for scripts/extract-chargen.mjs.
BasicUpstart2(start)
start:  sei
        lda #$33
        sta $01
        ldx #0
        ldy #16
loop:
src:    lda $d000,x
dst:    sta $4000,x
        inx
        bne loop
        inc src+2
        inc dst+2
        dey
        bne loop
        lda #$37
        sta $01
        lda #1
        sta $3fff
        cli
        rts
