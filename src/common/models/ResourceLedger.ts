import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose'
import { getEnumKeyByValue } from '#root/common/helpers/enum'

export enum ResourceKind {
  Gold = 'gold',
  Iron = 'iron',
  Mana = 'mana',
  Food = 'food',
}

export enum ResourceChangeType {
  Unknown = -1,
  Production = 0, // faucet: 8h castle production
  Upgrade = 1, // sink: spent on a castle upgrade track
  Loot = 2, // reserved: future PvE/expedition loot
  Recruit = 3, // sink: Gold spent recruiting a hero
  Raid = 4, // raid: Food upkeep (sink) + plundered loot (zero-sum transfer, both sides)
}

export type ResourceChangeKeys = keyof typeof ResourceChangeType

export function getResourceChangeTypeName(
  type: ResourceChangeType,
): ResourceChangeKeys {
  return getEnumKeyByValue(ResourceChangeType, type) ?? 'Unknown'
}

@modelOptions({
  schemaOptions: { timestamps: { createdAt: true, updatedAt: false } },
})
class ResourceLedger {
  @prop({ type: Number, required: true, index: true })
  userId!: number

  @prop({ type: String, required: true, enum: ResourceKind })
  kind!: ResourceKind

  // Signed: positive = produced/looted, negative = spent.
  @prop({ type: Number, required: true })
  amount!: number

  @prop({ type: Number, required: true, index: true })
  type!: ResourceChangeType

  @prop({ type: Date, required: false })
  createdAt?: Date
}

const ResourceLedgerModel = getModelForClass(ResourceLedger)

export { ResourceLedgerModel }

export async function addResourceRecords(
  userId: number,
  rows: Array<{ kind: ResourceKind, amount: number, type: ResourceChangeType }>,
): Promise<void> {
  const docs = rows.filter(r => r.amount !== 0).map(r => ({ userId, ...r }))
  if (docs.length === 0) return
  await ResourceLedgerModel.insertMany(docs)
}
