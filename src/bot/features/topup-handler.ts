// Pure Stars top-up payment logic: payload parsing + the idempotent credit.
// The composer (topup.ts) wires Telegram updates and the DB/ledger deps.

export interface TopupPayload {
  userId: number
  stars: number
  votes: bigint
}

// Payload format: 'cube-topup:<userId>:<stars>:<votes>' (see topup-invoice-handler).
export function parseTopupPayload(payload: string): TopupPayload | null {
  const parts = payload.split(':')
  if (parts.length !== 4 || parts[0] !== 'cube-topup') return null
  const userId = Number(parts[1])
  const stars = Number(parts[2])
  if (!Number.isSafeInteger(userId) || userId <= 0) return null
  if (!Number.isSafeInteger(stars) || stars <= 0) return null
  let votes: bigint
  try {
    votes = BigInt(parts[3])
  } catch {
    return null
  }
  if (votes <= 0n) return null
  return { userId, stars, votes }
}

export interface TopupPaymentDependencies {
  // Idempotency claim on the charge id. False ⇒ already processed, don't credit.
  record: (
    chargeId: string,
    userId: number,
    stars: number,
    votes: bigint,
  ) => Promise<boolean>
  credit: (userId: number, votes: bigint) => Promise<void>
  notifyUser: (userId: number, votes: bigint) => Promise<void>
  logError: (message: string) => void
}

export type TopupResult =
  | { ok: true, userId: number, votes: bigint }
  | { ok: false, reason: 'bad-payload' | 'duplicate' | 'credit-failed' }

export function buildTopupPaymentHandler(deps: TopupPaymentDependencies) {
  return async function handleTopupPayment(
    payload: string,
    chargeId: string,
  ): Promise<TopupResult> {
    const parsed = parseTopupPayload(payload)
    if (!parsed) return { ok: false, reason: 'bad-payload' }

    // Claim the charge FIRST: a redelivered successful_payment update loses
    // here and never double-credits.
    const fresh = await deps.record(
      chargeId,
      parsed.userId,
      parsed.stars,
      parsed.votes,
    )
    if (!fresh) return { ok: false, reason: 'duplicate' }

    try {
      await deps.credit(parsed.userId, parsed.votes)
    } catch (err) {
      // The charge row exists but the votes didn't land — bias to false-error.
      // Operator reconciles StarsPurchase rows against the Balance ledger.
      deps.logError(
        `!!! Stars top-up credit failed for ${parsed.userId}, charge ${chargeId}: ${(err as Error).message}`,
      )
      return { ok: false, reason: 'credit-failed' }
    }

    try {
      await deps.notifyUser(parsed.userId, parsed.votes)
    } catch (err) {
      deps.logError(
        `Top-up notify failed for ${parsed.userId}: ${(err as Error).message}`,
      )
    }

    return { ok: true, userId: parsed.userId, votes: parsed.votes }
  }
}
