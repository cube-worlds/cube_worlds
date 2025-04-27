export function tonToPoints(ton: number): bigint {
    let rate = 100_000
    const halvingDate = new Date(2024, 4, 15, 0, 0, 0)
    const currentDate = new Date()
    if (currentDate > halvingDate) {
        rate = 50_000
    }
    let points = BigInt(Math.round(ton * rate))
    if (points === BigInt(0)) {
        points = BigInt(1)
    }
    return points
}

export function usdToPoints(usd: number): bigint {
    const tonUSDPrice = 5
    return tonToPoints(usd / tonUSDPrice)
}
