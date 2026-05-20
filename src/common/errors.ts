/**
 * Errors whose message is intentionally safe to surface to the API client.
 * Anything else is sanitized at the route boundary so internal details
 * (Mongoose, third-party validators, config issues) don't leak.
 *
 * Domain code throws this when the failure has a well-defined user-facing
 * meaning (e.g. "Claim is not available yet"). Plain `Error` is reserved for
 * invariant violations and infrastructure failures.
 */
export class ClientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ClientError'
  }
}
