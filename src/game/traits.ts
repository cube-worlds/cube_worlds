// The pass NFT carries 120 personality traits (random 1–10, public on chain).
// Every Bali engine reads them through these helpers. Missing traits (metadata
// outage, pre-trait passes) read as 5 so play never blocks.

export type Traits = Record<string, number>

export const DEFAULT_TRAIT = 5

export function parseTraits(attributes: unknown): Traits {
  if (!Array.isArray(attributes)) return {}
  const traits: Traits = {}
  for (const entry of attributes) {
    if (!entry || typeof entry !== 'object') continue
    const { trait_type, value } = entry as { trait_type?: unknown, value?: unknown }
    const numeric = Number(value)
    if (typeof trait_type !== 'string' || !Number.isFinite(numeric)) continue
    traits[trait_type] = numeric
  }
  return traits
}

export function traitOf(traits: Traits | undefined, name: string): number {
  const value = traits?.[name]
  return typeof value === 'number' ? value : DEFAULT_TRAIT
}

export function weightOf(traits: Traits | undefined, names: readonly string[]): number {
  return names.reduce((sum, name) => sum + traitOf(traits, name), 0)
}

export function topTraits(traits: Traits, n: number): Array<{ name: string, value: number }> {
  return Object.entries(traits)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    .slice(0, n)
}
