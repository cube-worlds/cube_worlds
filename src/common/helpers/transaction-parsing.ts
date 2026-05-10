import type { Address, Transaction } from '@ton/core'

export interface ParsedInMessage {
  source: Address
  value: bigint
  text: string | undefined
}

export function parseInternalInMessage(tx: Transaction): ParsedInMessage | null {
  const inMessage = tx.inMessage
  if (!inMessage || inMessage.info.type !== 'internal') return null

  let text: string | undefined
  try {
    const slice = inMessage.body.beginParse()
    if (slice.remainingBits >= 32) {
      const op = slice.loadUint(32)
      if (op === 0) {
        text = slice.loadStringTail()
      }
    }
  } catch {
    text = undefined
  }

  return {
    source: inMessage.info.src,
    value: inMessage.info.value.coins,
    text,
  }
}
