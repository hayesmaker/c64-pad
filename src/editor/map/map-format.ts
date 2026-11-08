/** `$0F`, `$0400`: hex as on the worksheet. */
export const hex = (n: number, digits = 2) =>
  '$' + n.toString(16).toUpperCase().padStart(digits, '0')
