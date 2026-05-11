export interface AppendOwnRowOptions<T> {
  body: string[][]
  topN: T[]
  ownMatches: (item: T) => boolean
  buildOwnRow: () => Promise<string[] | null> | string[] | null
}

export async function appendOwnRowIfMissing<T>(
  options: AppendOwnRowOptions<T>,
): Promise<string[][]> {
  if (options.topN.some(options.ownMatches)) {
    return options.body
  }
  const row = await options.buildOwnRow()
  if (!row) {
    return options.body
  }
  return [...options.body, ['...', '...', '...'], row]
}
