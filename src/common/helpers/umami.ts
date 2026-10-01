import { createHash } from 'node:crypto'

// Umami (self-hosted, https://analytics.nextgensoft.co) server-side events —
// infra docs/runbook-analytics.md. Website id is public; empty ⇒ tracking off.
const UMAMI_SEND = 'https://analytics.nextgensoft.co/api/send'
// Umami runs `isbot` on the User-Agent and answers 200 while silently dropping
// anything that matches (curl, node, *bot*) — a browser-looking UA is load-bearing.
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'

let websiteId = ''

export function configureUmami(id: string): void {
  websiteId = id
}

// Stable, non-reversible per-user id for Umami's `id` field (no raw Telegram ids leave the box).
export function umamiUserId(telegramId: number): string {
  return createHash('sha256').update(String(telegramId)).digest('hex').slice(0, 16)
}

export function umamiPayload(name: string, telegramId?: number) {
  return {
    type: 'event',
    payload: {
      website: websiteId,
      hostname: 'cubeworlds.club',
      url: `/${name}`,
      name,
      ...(telegramId ? { id: umamiUserId(telegramId) } : {}),
    },
  }
}

// Fire-and-forget: never awaited by a handler, never throws, 2 s cap. No-op until configured.
export function trackEvent(name: string, telegramId?: number): void {
  if (!websiteId) return
  fetch(UMAMI_SEND, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': UA },
    body: JSON.stringify(umamiPayload(name, telegramId)),
    signal: AbortSignal.timeout(2000),
  }).catch(() => {})
}
