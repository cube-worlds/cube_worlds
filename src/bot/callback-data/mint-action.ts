import { createCallbackData } from 'callback-data'

// Admin queue actions on a specific user's mint draft: approve (pin + mint) or
// return-to-work (back to Rework). userId is carried so the callback is
// self-contained and not tied to mutable admin session state.
export const mintActionData = createCallbackData('mint-action', {
  action: String,
  userId: Number,
})

export enum MintAction {
  Approve = 'approve',
  Return = 'return',
}
