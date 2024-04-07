export function bigIntWithCustomSeparator(x: bigint, separator = ","): string {
  return x.toString().replaceAll(/\B(?=(\d{3})+(?!\d))/g, separator);
}
