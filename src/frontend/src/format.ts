// Lives here rather than in WalletScreen so that PassScan and HeroTab can
// format an address without statically importing a TON Connect screen — that
// import is what used to pull the whole wallet stack into the entry chunk.
export function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}
