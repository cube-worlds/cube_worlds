// Minimal structural type for the injected fetch (compatible with node-fetch and
// the test fake). We only use the bits we need.
export interface FetchResponse {
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text: () => Promise<string>
}
export type FetchLike = (
  url: string,
  init?: { method?: string, headers?: Record<string, string>, body?: string },
) => Promise<FetchResponse>

export interface XRocketClientDependencies {
  fetch: FetchLike
  apiKey: string
  baseUrl: string
}

export interface CreateInvoiceInput {
  amount: number
  currency: string
  payload: string
  callbackUrl: string
  expiredIn?: number
  numPayments?: number
}
export interface InvoiceData {
  id: number
  link: string
  status: string
  currency: string
  amount: number
  payload: string
}
export interface TransferInput {
  tgUserId: number
  currency: string
  amount: number
  transferId: string
  description?: string
}
export interface WithdrawalInput {
  network: string
  address: string
  currency: string
  amount: number
  withdrawalId: string
  comment?: string
}
export interface WithdrawalData {
  status: 'CREATED' | 'COMPLETED' | 'FAIL'
  txHash: string | null
  txLink: string | null
}
export interface WithdrawalFee {
  code: string
  minWithdraw: number
  fees: Array<{ networkCode: string, feeWithdraw: { fee: number, currency: string } }>
}
export interface AppInfo {
  name: string
  feePercents: number
  balances: Array<{ currency: string, balance: number }>
}
export interface MultiChequeInput {
  currency: string
  chequePerUser: number
  usersNumber: number
  refProgram?: number
  description?: string
}
export interface MultiChequeData {
  id: number
  link: string
  state: string
}
interface ApiEnvelope<T> {
  success: boolean
  data?: T
  message?: string
}

export interface XRocketClient {
  createInvoice: (input: CreateInvoiceInput) => Promise<InvoiceData>
  transfer: (input: TransferInput) => Promise<{ id: number }>
  withdrawal: (input: WithdrawalInput) => Promise<WithdrawalData>
  getWithdrawalFees: (currency: string) => Promise<WithdrawalFee[]>
  appInfo: () => Promise<AppInfo>
  multiCheque: (input: MultiChequeInput) => Promise<MultiChequeData>
}

export function buildXRocketClient(deps: XRocketClientDependencies): XRocketClient {
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await deps.fetch(`${deps.baseUrl}${path}`, {
      method,
      headers: {
        'Rocket-Pay-Key': deps.apiKey,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!res.ok) {
      throw new Error(`xRocket ${path} HTTP ${res.status}: ${await res.text()}`)
    }
    const envelope = (await res.json()) as ApiEnvelope<T>
    if (!envelope.success) {
      throw new Error(`xRocket ${path} failed: ${envelope.message ?? 'unknown error'}`)
    }
    return envelope.data as T
  }

  return {
    createInvoice: input =>
      call<InvoiceData>('POST', '/tg-invoices', { numPayments: 1, ...input }),
    transfer: input => call<{ id: number }>('POST', '/app/transfer', input),
    withdrawal: input => call<WithdrawalData>('POST', '/app/withdrawal', input),
    getWithdrawalFees: currency =>
      call<WithdrawalFee[]>('GET', `/app/withdrawal/fees?currency=${encodeURIComponent(currency)}`),
    appInfo: () => call<AppInfo>('GET', '/app/info'),
    multiCheque: input =>
      call<MultiChequeData>('POST', '/multi-cheque', { refProgram: 0, ...input }),
  }
}
