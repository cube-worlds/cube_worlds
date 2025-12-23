export function tonToPoints(ton: number): bigint {
  const initialRate = 100_000
  const halvingStart = new Date(2024, 4, 15)
  const currentDate = new Date()

  let halvings = 0
  if (currentDate > halvingStart) {
    const yearsPassed = currentDate.getFullYear() - halvingStart.getFullYear()

    // Проверяем каждую годовщину: прошла ли она
    for (let i = 1; i <= yearsPassed; i++) {
      const anniversary = new Date(
        halvingStart.getFullYear() + i,
        halvingStart.getMonth(),
        halvingStart.getDate(),
      )
      if (currentDate >= anniversary) {
        halvings++
      }
    }
  }

  const rate = Math.max(initialRate >> halvings, 1) // защита, чтобы не ушло в 0

  let points = BigInt(Math.round(ton * rate))
  if (points === 0n) points = 1n

  return points
}
