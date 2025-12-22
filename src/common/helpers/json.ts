export function stringifyBigInt(param: unknown): string {
    return JSON.stringify(
        param,
        (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
    )
}

export function stringifyBigIntToJSON(param: unknown): JSON {
    return JSON.parse(stringifyBigInt(param))
}
