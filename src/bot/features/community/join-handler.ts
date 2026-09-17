// A member joined via someone's personal invite link (link name = inviter's
// user id, see community-api-handler). Creates the shell and attributes the
// referral; the payout happens at first app login (auth-handler).
export interface JoinUpdate {
  chat: { id: number }
  from: { id: number }
  old_chat_member: { status: string }
  new_chat_member: { status: string, user: { id: number, is_bot: boolean, language_code?: string } }
  invite_link?: { name?: string }
}

export interface JoinDependencies {
  findOrCreateUser: (id: number) => Promise<unknown>
  setChatReferral: (joinerId: number, inviterId: number, language: 'en' | 'ru') => Promise<boolean>
  logInfo: (message: string) => void
}

const JOINED_FROM = new Set(['left', 'kicked'])

export function parseInviterId(linkName: string | undefined): number | null {
  if (!linkName || !/^\d+$/.test(linkName)) return null
  const id = Number(linkName)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export function buildJoinHandler(deps: JoinDependencies) {
  return async function handleJoin(update: JoinUpdate): Promise<void> {
    const joiner = update.new_chat_member.user
    if (joiner.is_bot) return
    if (update.new_chat_member.status !== 'member' || !JOINED_FROM.has(update.old_chat_member.status)) return
    const inviterId = parseInviterId(update.invite_link?.name)
    if (!inviterId || inviterId === joiner.id) return

    await deps.findOrCreateUser(joiner.id)
    const language = joiner.language_code === 'ru' ? 'ru' : 'en'
    const set = await deps.setChatReferral(joiner.id, inviterId, language)
    if (set) deps.logInfo(`Community: ${joiner.id} joined ${update.chat.id} via ${inviterId}`)
  }
}
