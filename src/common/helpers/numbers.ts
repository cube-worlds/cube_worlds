function bigIntWithCustomSeparator(
  x: bigint | number | string,
  separator = ',',
): string {
  let string = ''
  if (typeof x === 'number') {
    string = x.toString()
  } else if (typeof x === 'bigint') {
    string = x.toString()
  } else {
    string = x
  }
  return string.replaceAll(/\B(?=(\d{3})+(?!\d))/g, separator)
}

export function commaSeparatedNumber(input: number | bigint): string {
  return bigIntWithCustomSeparator(input, ',')
}

export function kFormatter(input: number | bigint): string {
  const formatter = Intl.NumberFormat('en', { notation: 'compact' })
  return formatter.format(input)
}
