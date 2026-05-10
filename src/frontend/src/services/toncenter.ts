import { Cell } from '@ton/core'

type StackItem =
  | ['num', string]
  | ['cell', { bytes: string }]
  | ['tuple', unknown]
  | ['list', unknown]
  | [string, unknown]

interface RunGetMethodResponse {
  ok: boolean
  error?: string
  result?: {
    stack: StackItem[]
    exit_code: number
    gas_used: number
  }
}

const isDev = import.meta.env.VITE_ENV === 'development'

export const TONCENTER_BASE = isDev
  ? 'https://testnet.toncenter.com/api/v2'
  : 'https://toncenter.com/api/v2'

export async function runGetMethod(
  address: string,
  method: string,
  stack: unknown[] = [],
): Promise<StackItem[]> {
  const response = await fetch(`${TONCENTER_BASE}/runGetMethod`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, method, stack }),
  })
  if (!response.ok) {
    throw new Error(`toncenter HTTP ${response.status}`)
  }
  const json = (await response.json()) as RunGetMethodResponse
  if (!json.ok || !json.result) {
    throw new Error(json.error ?? 'toncenter call failed')
  }
  return json.result.stack
}

export function readNum(item: StackItem): bigint {
  if (item[0] !== 'num') throw new Error(`Expected num, got ${item[0]}`)
  return BigInt(item[1] as string)
}

export function readCell(item: StackItem): Cell {
  if (item[0] !== 'cell') throw new Error(`Expected cell, got ${item[0]}`)
  return Cell.fromBase64((item[1] as { bytes: string }).bytes)
}
