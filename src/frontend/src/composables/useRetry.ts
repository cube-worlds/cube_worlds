export function useRetry() {
  async function retry<T>(
    fn: () => Promise<T>,
    maxRetries = 10,
    delay = 1000,
  ): Promise<T | null> {
    let retries = 0
    while (retries <= maxRetries) {
      try {
        return await fn()
      } catch {
        retries++
        if (retries > maxRetries) return null
        await new Promise((res) => setTimeout(res, delay))
        delay *= 2
      }
    }
    return null
  }
  return { retry }
}
