// Thin access layer over the Telegram Mini App bridge (telegram-web-app.js,
// loaded in index.html). Everything degrades gracefully in a plain browser so
// the app can be developed outside Telegram.

import type { WebApp } from 'telegram-web-app'

export function webApp(): WebApp | undefined {
  return window.Telegram?.WebApp
}

export function getInitData(): string {
  return webApp()?.initData ?? ''
}

export function getStartParam(): string | undefined {
  return webApp()?.initDataUnsafe?.start_param
}

export function expand(): void {
  try {
    webApp()?.expand()
  } catch {
    // not inside Telegram
  }
}

export function haptic(type: 'light' | 'success' | 'error'): void {
  try {
    const feedback = webApp()?.HapticFeedback
    if (!feedback) return
    if (type === 'light') feedback.impactOccurred('light')
    else feedback.notificationOccurred(type)
  } catch {
    // not inside Telegram
  }
}

// Opens a Telegram Stars invoice inside the Mini App. Resolves with the final
// status ('paid' | 'cancelled' | 'failed' | 'pending').
export function openInvoice(link: string): Promise<string> {
  return new Promise((resolve) => {
    const app = webApp()
    if (!app) {
      window.open(link, '_blank')
      resolve('pending')
      return
    }
    app.openInvoice(link, (status: string) => resolve(status))
  })
}

export function openShare(url: string, text: string): void {
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
  const app = webApp()
  if (app) app.openTelegramLink(shareUrl)
  else window.open(shareUrl, '_blank')
}
