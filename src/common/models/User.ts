import type { Address } from '@ton/core'
import type { DocumentType } from '@typegoose/typegoose'
import type {
  ClipGuidancePreset,
  SDSampler,
} from '#root/common/helpers/generation'
import { getModelForClass, index, modelOptions, prop, Severity } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import {
  addChangeBalanceRecord,
  BalanceChangeType,
  countAllBalanceRecords,
  countUserBalanceRecords,
  getAggregatedBalance,
} from '#root/common/models/Balance'
import { logger } from '#root/logger'

export enum UserState {
  WaitNothing = 'WaitNothing',
  Submited = 'Submited',
  // Admin returned the draft for changes — the user can regenerate in the app,
  // which clears this back to Submited.
  Rework = 'Rework',
}

// Snapshot of the Cube Worlds NFT the user plays as. Written only by
// /api/pass/select (on-chain ownership check); revalidated hourly on login.
@modelOptions({ schemaOptions: { _id: false }, options: { allowMixed: Severity.ALLOW } })
export class UserPass {
  @prop({ type: Number, required: true })
  index!: number

  @prop({ type: String, required: true })
  address!: string

  @prop({ type: String, required: true })
  name!: string

  @prop({ type: String, required: true, default: '' })
  image!: string

  @prop({ type: Date, required: true })
  verifiedAt!: Date

  // All 120 on-chain personality traits (name → 1..10). Filled at pass select,
  // backfilled by /api/world/state for passes that predate Bali.
  @prop({ type: () => Object })
  traits?: Record<string, number>
}

// Public reputation from Bali pair/commons games. Bumped at window resolution.
@modelOptions({ schemaOptions: { _id: false } })
export class UserRep {
  @prop({ type: Number, required: true, default: 0 })
  helped!: number

  @prop({ type: Number, required: true, default: 0 })
  stole!: number

  @prop({ type: Number, required: true, default: 0 })
  gave!: number

  @prop({ type: Number, required: true, default: 0 })
  took!: number
}

@index({ 'pass.index': 1 })
@modelOptions({ schemaOptions: { timestamps: true, id: false } })
export class User extends TimeStamps {
  @prop({ type: Number, required: true, unique: true })
  id!: number

  @prop({ type: String, required: true, default: 'en' })
  language!: string

  @prop({ type: Boolean })
  languageSelected?: boolean

  @prop({ type: String, required: false, default: UserState.WaitNothing })
  state!: UserState

  @prop({ type: BigInt, required: false, default: 0 })
  votes!: bigint

  @prop({ type: Number })
  referalId?: number

  @prop({ type: String })
  name?: string

  // user provided description
  @prop({ type: String })
  description?: string

  // result that will be in NFT
  @prop({ type: String })
  nftDescription?: string

  @prop({ type: String })
  image?: string

  @prop({ type: String })
  avatar?: string

  @prop({ type: String, index: { unique: true, sparse: true } })
  wallet?: string

  @prop({ type: () => UserPass })
  pass?: UserPass

  @prop({ type: () => UserRep })
  rep?: UserRep

  @prop({ type: Number })
  lastSendedPlace?: number // for notification purposes

  @prop({ type: Boolean, required: true, default: false })
  minted!: boolean

  // Transient CAS guard: set true while an admin-approved mint is in flight so
  // a double-approve can't mint twice. Cleared on success or on retry release.
  @prop({ type: Boolean })
  mintingInProgress?: boolean

  @prop({ type: Date })
  mintedAt?: Date

  @prop({ type: Boolean })
  diceWinner?: boolean

  // for admin

  @prop({ type: Number })
  selectedUser?: number

  @prop({ type: Number })
  avatarNumber?: number

  @prop({ type: String })
  nftImage?: string

  @prop({ type: String })
  nftJson?: string

  @prop({ type: String })
  nftUrl?: string

  // to spoof user provided description
  @prop({ type: String })
  customDescription?: string

  @prop({ type: String })
  positivePrompt?: string

  @prop({ type: String })
  negativePrompt?: string

  @prop({ type: Number })
  strength?: number

  @prop({ type: Number })
  scale?: number

  @prop({ type: Number })
  steps?: number

  @prop({ type: String })
  preset?: ClipGuidancePreset

  @prop({ type: String })
  sampler?: SDSampler
}

const UserModel = getModelForClass(User)

// typegoose 13's DocumentType always intersects DefaultIdVirtual ({ id: string }),
// which collides with our Telegram numeric `id` field. Override at the type level.
export type UserDoc = Omit<DocumentType<User>, 'id'> & { id: number }

export async function findOrCreateUser(id: number): Promise<UserDoc | null> {
  const isEmptyRecords = (await countUserBalanceRecords(id)) === 0
  if (isEmptyRecords) {
    await addChangeBalanceRecord(id, BigInt(0), BalanceChangeType.Initial)
  }
  return UserModel.findOneAndUpdate(
    { id },
    {},
    {
      upsert: true,
      new: true,
    },
  ) as unknown as Promise<UserDoc | null>
}

export async function findUserByAddress(
  address: Address,
): Promise<UserDoc | null> {
  // EQ address
  const bounceableAddress = address.toString({ bounceable: true })
  // UQ address
  const nonBounceableAddress = address.toString({ bounceable: false })
  const user = await UserModel.findOne({
    wallet: bounceableAddress,
  })
  if (user) {
    return user as unknown as UserDoc
  }
  return UserModel.findOne({
    wallet: nonBounceableAddress,
  }) as unknown as Promise<UserDoc | null>
}

export async function findUserById(
  id: number,
): Promise<UserDoc | null> {
  return UserModel.findOne({ id }) as unknown as Promise<UserDoc | null>
}

// Overdraft-safe CUBE debit: atomically decrements votes by `amount` (positive)
// only if the balance covers it, then writes the Balance ledger row. Returns the
// new balance, or null if funds were insufficient / the CAS was lost. Mirrors
// applyDebit in the USDT wallet rail — use this for value-at-risk debits where a
// plain addPoints($inc) would allow a negative balance under concurrency.
export async function debitVotes(
  userId: number,
  amount: bigint,
  reason: BalanceChangeType,
): Promise<bigint | null> {
  const updated = (await UserModel.findOneAndUpdate(
    { id: userId, votes: { $gte: amount } },
    { $inc: { votes: -amount } },
    { new: true },
  )) as unknown as { votes: bigint } | null
  if (!updated) return null
  try {
    await addChangeBalanceRecord(userId, -amount, reason)
  } catch (recordError) {
    // Ledger write failed after the debit landed — compensate by reverting the
    // decrement so votes (cache) and Balance (truth) stay aligned, then rethrow.
    await UserModel.findOneAndUpdate({ id: userId }, { $inc: { votes: amount } })
    throw recordError
  }
  return updated.votes
}

export async function findUserByWallet(
  wallet: string,
): Promise<UserDoc | null> {
  return UserModel.findOne({ wallet }) as unknown as Promise<UserDoc | null>
}

export async function findUserByName(
  name: string,
): Promise<UserDoc | null> {
  return UserModel.findOne({ name }) as unknown as Promise<UserDoc | null>
}

export async function findQueue(): Promise<UserDoc[]> {
  return (await UserModel.find({ minted: false, state: UserState.Submited })
    .sort({ diceWinner: -1, votes: -1 })
    .limit(10)) as unknown as UserDoc[]
}

// Total NFTs minted so far.
export async function countMinted(): Promise<number> {
  return UserModel.countDocuments({ minted: true })
}

// Atomic CAS into the minting guard — only the first caller wins, so a
// double-approve mints exactly once. Returns true if this call claimed it.
export async function claimUserForMint(userId: number): Promise<boolean> {
  const claimed = await UserModel.findOneAndUpdate(
    { id: userId, minted: false, mintingInProgress: { $ne: true } },
    { $set: { mintingInProgress: true } },
    { new: true },
  )
  return claimed !== null
}

// Release the guard (only safe before the on-chain mint landed).
export async function releaseMintClaim(userId: number): Promise<void> {
  await UserModel.findOneAndUpdate(
    { id: userId },
    { $set: { mintingInProgress: false } },
  )
}

// Flip the user to minted and clear the guard — called after the on-chain mint.
export async function markUserMinted(
  userId: number,
  nftUrl: string,
  nftImage: string,
  nftJson: string,
): Promise<void> {
  await UserModel.findOneAndUpdate(
    { id: userId },
    {
      $set: {
        minted: true,
        mintedAt: new Date(),
        mintingInProgress: false,
        nftUrl,
        nftImage,
        nftJson,
      },
    },
  )
}

// Store (or refresh) the pass snapshot after an on-chain ownership check.
export async function setUserPass(
  userId: number,
  pass: { index: number, address: string, name: string, image: string, traits?: Record<string, number> },
  verifiedAt: Date,
): Promise<void> {
  const next: Record<string, unknown> = { index: pass.index, address: pass.address, name: pass.name, image: pass.image, verifiedAt }
  if (pass.traits) next.traits = pass.traits
  const existing = pass.traits ? null : await UserModel.findOne({ id: userId }, { 'pass.traits': 1 }).lean()
  const keep = (existing as { pass?: { traits?: Record<string, number> } } | null)?.pass?.traits
  if (keep) next.traits = keep
  await UserModel.findOneAndUpdate({ id: userId }, { $set: { pass: next } })
}

export async function setPassTraits(userId: number, traits: Record<string, number>): Promise<void> {
  await UserModel.findOneAndUpdate({ id: userId, pass: { $exists: true } }, { $set: { 'pass.traits': traits } })
}

export async function bumpRep(
  userId: number,
  delta: { helped?: number, stole?: number, gave?: number, took?: number },
): Promise<void> {
  const inc: Record<string, number> = {}
  for (const [key, value] of Object.entries(delta)) {
    if (value) inc[`rep.${key}`] = value
  }
  if (Object.keys(inc).length === 0) return
  await UserModel.findOneAndUpdate({ id: userId }, { $inc: inc })
}

export async function findUserByPassIndex(index: number): Promise<UserDoc | null> {
  return UserModel.findOne({ 'pass.index': index }) as unknown as Promise<UserDoc | null>
}

export async function findUsersByIds(ids: number[]): Promise<UserDoc[]> {
  if (ids.length === 0) return []
  return UserModel.find({ id: { $in: ids } }) as unknown as Promise<UserDoc[]>
}

// Drop the snapshot when the NFT is no longer in the bound wallet.
export async function clearUserPass(userId: number): Promise<void> {
  await UserModel.findOneAndUpdate({ id: userId }, { $unset: { pass: 1 } })
}

// Move a draft back to Rework (admin returned it for changes).
export async function setUserRework(userId: number): Promise<void> {
  await UserModel.findOneAndUpdate(
    { id: userId },
    { $set: { state: UserState.Rework } },
  )
}

export function findMintedWithDate() {
  return UserModel.find({ minted: true, mintedAt: { $exists: true } }).sort({
    mintedAt: -1,
  })
}

export async function countAllBalances(): Promise<number> {
  const result = await UserModel.aggregate([
    { $group: { _id: undefined, sum: { $sum: '$votes' } } },
  ])
  if (result.length === 0) {
    return 0
  }
  return Number.parseFloat(result[0].sum)
}

export function countAllWallets(): Promise<number> {
  return UserModel.countDocuments({ wallet: { $exists: true } })
}

export function countActiveSince(since: Date): Promise<number> {
  return UserModel.countDocuments({ updatedAt: { $gte: since } })
}

export function countAllLine(): Promise<number> {
  return UserModel.countDocuments({
    state: UserState.Submited,
    minted: false,
  })
}

export async function findAllByCreated(): Promise<UserDoc[]> {
  return (await UserModel.find({ wallet: { $exists: true } }).sort({
    createdAt: 1,
  })) as unknown as UserDoc[]
}

export function findWhales(limit: number, skip: number = 0) {
  return UserModel.find({ wallet: { $exists: true } })
    .select({ _id: 0, wallet: 1, votes: 1, minted: 1 })
    .limit(limit)
    .skip(skip)
    .sort({ votes: -1 })
}

export function findLine(limit: number) {
  return UserModel.find({
    state: UserState.Submited,
    minted: false,
  })
    .select({ _id: 0, name: 1, votes: 1, minted: 1, diceWinner: 1 })
    .limit(limit)
    .sort({ diceWinner: -1, votes: -1 })
}

export function countUsers(minted: boolean) {
  return UserModel.countDocuments({ minted, state: UserState.Submited })
}

export interface UserOperationsDependencies {
  countLineWhereVotesGte: (votes: bigint) => Promise<number>
  countWhalesWhereVotesGte: (votes: bigint) => Promise<number>
  incrementUserVotes: (
    userId: number,
    add: bigint,
  ) => Promise<{ votes: bigint } | null>
  addChangeBalanceRecord: (
    userId: number,
    amount: bigint,
    reason: BalanceChangeType,
  ) => Promise<{ amount: bigint }>
  getAggregatedBalance: (userId: number) => Promise<bigint>
  countAllUsers: () => Promise<number>
  countMintedUsers: () => Promise<number>
  countLineUsers: () => Promise<number>
  countUsersUpdatedSince: (since: Date) => Promise<number>
  now: () => number
  infoLog: (message: string) => void
  debugLog: (message: string) => void
  errorLog: (message: string) => void
}

function createDefaultUserOperationsDependencies(): UserOperationsDependencies {
  return {
    countLineWhereVotesGte: (votes) =>
      UserModel.countDocuments({
        minted: false,
        state: UserState.Submited,
        votes: { $gte: votes },
      }),
    countWhalesWhereVotesGte: (votes) =>
      UserModel.countDocuments({ votes: { $gte: votes } }),
    incrementUserVotes: (userId, add) =>
      UserModel.findOneAndUpdate(
        { id: userId },
        { $inc: { votes: add } },
        { new: true },
      ) as unknown as Promise<{ votes: bigint } | null>,
    addChangeBalanceRecord,
    getAggregatedBalance,
    countAllUsers: () => UserModel.countDocuments(),
    countMintedUsers: () => countUsers(true),
    countLineUsers: () => countUsers(false),
    countUsersUpdatedSince: (since) =>
      UserModel.countDocuments({ updatedAt: { $gte: since } }),
    now: () => Date.now(),
    infoLog: (message) => logger.info(message),
    debugLog: (message) => logger.debug(message),
    errorLog: (message) => logger.error(message),
  }
}

export function buildUserOperations(
  deps: UserOperationsDependencies = createDefaultUserOperationsDependencies(),
) {
  async function placeInLine(votes: bigint): Promise<number | undefined> {
    const count = await deps.countLineWhereVotesGte(votes)
    if (count === 0) {
      return undefined
    }
    return count
  }

  async function placeInWhales(votes: bigint): Promise<number | undefined> {
    const count = await deps.countWhalesWhereVotesGte(votes)
    if (count === 0) {
      return undefined
    }
    return count
  }

  async function addPoints(
    userId: number,
    add: bigint,
    reason: BalanceChangeType,
  ): Promise<bigint> {
    try {
      const updatedUser = await deps.incrementUserVotes(userId, add)
      if (!updatedUser) {
        throw new Error('User for addPoints not found')
      }

      let newRecord
      try {
        newRecord = await deps.addChangeBalanceRecord(userId, add, reason)
      } catch (recordError) {
        // The vote cache moved but the ledger didn't. Compensate by
        // reversing the increment so Balance (truth) and User.votes (cache)
        // stay aligned. If the revert itself fails, log loudly — the
        // operator has to reconcile by replaying the missing audit entry.
        try {
          await deps.incrementUserVotes(userId, -add)
          deps.errorLog(
            `!!! addPoints reverted +${add} for ${userId} after audit write failed`,
          )
        } catch {
          deps.errorLog(
            `!!! addPoints unrecoverable drift for ${userId}: votes incremented by ${add} with no Balance row and revert failed`,
          )
        }
        throw recordError
      }

      deps.debugLog(
        `Add ${newRecord.amount} points to user ${userId}. Now ${await deps.getAggregatedBalance(userId)}`,
      )

      deps.infoLog(`Add ${add} points to ${userId}. Now ${updatedUser.votes}`)
      return updatedUser.votes
    } catch (error) {
      deps.errorLog(`!!! Can't add points ${add} to user ${userId}`)
      throw error
    }
  }

  async function userStats() {
    const all = await deps.countAllUsers()
    const minted = await deps.countMintedUsers()
    const notMinted = await deps.countLineUsers()
    const now = deps.now()
    const dayMs = 24 * 60 * 60 * 1000
    const monthAgo = new Date(now - 30 * dayMs)
    const weekAgo = new Date(now - 7 * dayMs)
    const dayAgo = new Date(now - 1 * dayMs)
    const month = await deps.countUsersUpdatedSince(monthAgo)
    const week = await deps.countUsersUpdatedSince(weekAgo)
    const day = await deps.countUsersUpdatedSince(dayAgo)
    return { all, minted, notMinted, month, week, day }
  }

  return { placeInLine, placeInWhales, addPoints, userStats }
}

const defaultUserOps = buildUserOperations()

export const placeInLine = defaultUserOps.placeInLine
export const placeInWhales = defaultUserOps.placeInWhales
export const addPoints = defaultUserOps.addPoints
export const userStats = defaultUserOps.userStats

export async function createInitialBalancesIfNotExists() {
  if ((await countAllBalanceRecords()) > 0) {
    return
  }
  const users = (await UserModel.find()) as unknown as UserDoc[]
  await Promise.all(
    users.map((user) =>
      addChangeBalanceRecord(user.id, user.votes, BalanceChangeType.Initial),
    ),
  )
}
