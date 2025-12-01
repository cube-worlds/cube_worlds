export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

export function timeUnitsBetween(startDate: Date, endDate: Date) {
    let delta = Math.abs(endDate.getTime() - startDate.getTime()) / 1000
    const isNegative = startDate > endDate ? -1 : 1
    const units: [[string, number], [string, number], [string, number], [string, number]] = [
        ['days', 24 * 60 * 60],
        ['hours', 60 * 60],
        ['minutes', 60],
        ['seconds', 1],
    ]

    return units.reduce(
        (accumulator: any, [key, value]) =>
            (
            // eslint-disable-next-line no-sequences
                (accumulator[key] = Math.floor(delta / value) * isNegative),
                (delta -= accumulator[key] * isNegative * value),
                accumulator
            ),
        {},
    )
}

export function formatDateTimeCompact(input: Date): string {
    const d = input.toISOString().split('T')
    const date = d[0].slice(2) // .split("-").join("/")
    const time = d[1].split('.')[0]
    return `${date} ${time}`
}
