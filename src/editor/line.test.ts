import { describe, expect, it } from 'vitest'
import { lineCells } from './line'

describe('lineCells', () => {
  it('returns a single cell for a point', () => {
    expect(lineCells(3, 4, 3, 4)).toEqual([[3, 4]])
  })
  it('covers horizontal, vertical and diagonal lines without gaps', () => {
    expect(lineCells(0, 0, 3, 0)).toHaveLength(4)
    expect(lineCells(2, 5, 2, 1)).toEqual([
      [2, 5],
      [2, 4],
      [2, 3],
      [2, 2],
      [2, 1],
    ])
    expect(lineCells(0, 0, 3, 3)).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
    ])
  })
  it('steps one cell at a time on shallow lines', () => {
    const cells = lineCells(0, 0, 10, 3)
    expect(cells[0]).toEqual([0, 0])
    expect(cells.at(-1)).toEqual([10, 3])
    for (let i = 1; i < cells.length; i++) {
      expect(Math.abs(cells[i][0] - cells[i - 1][0])).toBeLessThanOrEqual(1)
      expect(Math.abs(cells[i][1] - cells[i - 1][1])).toBeLessThanOrEqual(1)
    }
  })
})
