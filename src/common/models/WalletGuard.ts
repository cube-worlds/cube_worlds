import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose'

// Single-document switch the reconciliation worker flips to pause withdrawals
// and transfers when the local ledger diverges from xRocket custody.
@modelOptions({ schemaOptions: { timestamps: true } })
export class WalletGuard {
  @prop({ type: String, required: true, unique: true, default: 'withdrawals' })
  key!: string

  @prop({ type: Boolean, required: true, default: false })
  paused!: boolean

  @prop({ type: String, required: false })
  reason?: string
}

const WalletGuardModel = getModelForClass(WalletGuard)

export { WalletGuardModel }

const GUARD_KEY = 'withdrawals'

export async function areWithdrawalsPaused(): Promise<boolean> {
  const doc = await WalletGuardModel.findOne({ key: GUARD_KEY })
  return doc?.paused ?? false
}

export async function setWithdrawalsPaused(paused: boolean, reason?: string): Promise<void> {
  await WalletGuardModel.findOneAndUpdate(
    { key: GUARD_KEY },
    { $set: { paused, reason: reason ?? '' } },
    { upsert: true },
  )
}
