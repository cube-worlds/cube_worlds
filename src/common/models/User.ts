import type {
  ClipGuidancePreset,
  SDSampler,
} from '#root/common/helpers/generation'
import type { Address } from '@ton/core'
import type { DocumentType } from '@typegoose/typegoose'
import {
  addChangeBalanceRecord,
  BalanceChangeType,
  countAllBalanceRecords,
  countUserBalanceRecords,
  getAggregatedBalance,
} from '#root/common/models/Balance'
import { logger } from '#root/logger'
import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'

export enum UserState {
  WaitNothing = 'WaitNothing',
  WaitDescription = 'WaitDescription',
  WaitWallet = 'WaitWallet',
  Submited = 'Submited',
}

@modelOptions({ schemaOptions: { timestamps: true, id: false } })
export class User extends TimeStamps {
  @prop({ type: Number, required: true, index: true, unique: true })
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

  @prop({ type: Date, required: true, default: new Date(+0) })
  dicedAt!: Date

  @prop({ type: Number, min: 1, max: 6 })
  diceSeriesNumber?: number

  // how many times recurred
  @prop({ type: Number })
  diceSeries?: number

  // for captcha purposes
  @prop({ type: Number })
  suspicionDices?: number

  @prop({ type: String })
  captchaNonce?: string

  @prop({ type: Date })
  captchaIssuedAt?: Date

  // for dice callback query
  @prop({ type: String })
  diceKey?: string

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

  @prop({ type: Number })
  lastSendedPlace?: number // for notification purposes

  @prop({ type: Boolean, required: true, default: false })
  minted!: boolean

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

      const newRecord = await deps.addChangeBalanceRecord(userId, add, reason)
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
