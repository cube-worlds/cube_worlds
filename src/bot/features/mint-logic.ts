export const SUBSCRIBED_STATUSES = ['creator', 'administrator', 'member'] as const

export function isSubscribedStatus(status: string): boolean {
  return (SUBSCRIBED_STATUSES as readonly string[]).includes(status)
}
