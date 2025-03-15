export function bigIntWithCustomSeparator(x: bigint, separator = ','): string {
  return x.toString().replaceAll(/\B(?=(\d{3})+(?!\d))/g, separator)
}

export function kFormatter(input: number | bigint): string {
  const formatter = Intl.NumberFormat('en', { notation: 'compact' })
  return formatter.format(input)
}
