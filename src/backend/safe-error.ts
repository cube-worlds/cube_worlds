import { ClientError } from '#root/common/errors'

export { ClientError }

export const GENERIC_ERROR_MESSAGE = 'Unable to process request'

/**
 * Catch-branch helper for route handlers. `ClientError` messages pass through
 * unchanged; anything else is logged server-side and replaced with a generic
 * message so we don't leak Mongoose / third-party / config detail to clients.
 */
export function safeErrorResponse(
  err: unknown,
  logError: (message: string) => void,
): { error: string } {
  if (err instanceof ClientError) {
    return { error: err.message }
  }
  const message = err instanceof Error ? err.message : String(err)
  logError(`Unhandled handler error: ${message}`)
  return { error: GENERIC_ERROR_MESSAGE }
}
