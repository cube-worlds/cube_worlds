import { ClientError } from '#root/common/errors'

// In-app real balance is denominated in USDT, stored as bigint micro-USDT.
export const WALLET_CURRENCY = 'USDT'
export const MICRO_PER_USDT = 1_000_000n
// Hard upper bound on any single amount (matches xRocket invoice max of 1e6).
export const MAX_USDT_AMOUNT = 1_000_000

// Ledger entry types — the kind of money movement a WalletLedger row records.
export enum WalletEntryType {
  Deposit = 'deposit',
  Withdraw = 'withdraw',
  Transfer = 'transfer',
  BuyEnergy = 'buy_energy',
}

// Convert a USDT number (as xRocket reports) to bigint micro-USDT, rounding to
// the nearest micro-unit so float representation error never accumulates.
export function usdtToMicro(usdt: number): bigint {
  return BigInt(Math.round(usdt * Number(MICRO_PER_USDT)))
}

// For display only — may lose precision beyond 6 dp, which is fine for the UI.
export function microToUsdt(micro: bigint): number {
  return Number(micro) / Number(MICRO_PER_USDT)
}

// Validate a user-supplied USDT amount and return it as bigint micro-USDT.
// Throws ClientError on anything not a positive, finite, in-bounds number.
export function validateUsdtAmount(usdt: number): bigint {
  if (typeof usdt !== 'number' || !Number.isFinite(usdt) || usdt <= 0) {
    throw new ClientError('Invalid amount')
  }
  if (usdt > MAX_USDT_AMOUNT) {
    throw new ClientError('Amount too large')
  }
  return usdtToMicro(usdt)
}
