import { createCallbackData } from 'callback-data'

// Admin actions on a specific user's mint draft: approve (pin + mint) or
// decline (back to Rework — the user may regenerate and resubmit). userId is
// carried so the callback is self-contained and not tied to admin session state.
export const mintActionData = createCallbackData('mint-action', {
  action: String,
  userId: Number,
})

export enum MintAction {
  Approve = 'approve',
  Decline = 'decline',
}
