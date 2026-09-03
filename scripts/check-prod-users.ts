/* eslint-disable no-console */
/**
 * Read-only pre-cutover check: does the production (v1-era) database fit the
 * v3 models? Run it against a prod replica, dump, or the live DB — it only
 * ever calls find/aggregate.
 *
 *   CHECK_MONGO_URI='mongodb://.../cubeworlds' npx tsx scripts/check-prod-users.ts
 *
 * BLOCKING findings (exit 1):
 *   - duplicate `wallet` values  → the v3 unique sparse index cannot build
 *   - duplicate `id` values      → same, for the primary user index
 *   - `votes` that cannot cast to BigInt (fractional doubles, strings, NaN)
 *   - `state` values outside the v3 enum
 * Everything else is reported as a warning.
 */
import process from 'node:process'
import mongoose from 'mongoose'

const ALLOWED_STATES = new Set(['WaitNothing', 'Submited', 'Rework'])
const SAMPLE_SIZE = 1000

let blocking = 0
let warnings = 0

function block(message: string) {
  blocking += 1
  console.error(`  ❌ BLOCKING: ${message}`)
}

function warn(message: string) {
  warnings += 1
  console.warn(`  ⚠️  ${message}`)
}

function ok(message: string) {
  console.log(`  ✅ ${message}`)
}

interface TypeBucket {
  _id: string
  count: number
}

async function run() {
  const uri = process.env.CHECK_MONGO_URI
  if (!uri) {
    console.error('Set CHECK_MONGO_URI to the production connection string (read access is enough).')
    process.exit(1)
  }

  const connection = await mongoose.createConnection(uri).asPromise()
  const db = connection.db!
  const users = db.collection('users')

  try {
    const total = await users.countDocuments()
    console.log(`users: ${total} document(s)\n`)

    // --- id ------------------------------------------------------------------
    console.log('id')
    const idDupes = await users.aggregate([
      { $group: { _id: '$id', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 10 },
    ]).toArray()
    if (idDupes.length > 0) {
      block(`duplicate id values: ${idDupes.map((d) => d._id).join(', ')}${idDupes.length === 10 ? ', …' : ''}`)
    } else {
      ok('no duplicate ids')
    }
    const idMissing = await users.countDocuments({ id: { $not: { $type: 'number' } } })
    if (idMissing > 0) block(`${idMissing} doc(s) with missing/non-numeric id`)
    else ok('every id is numeric')

    // --- votes → BigInt cast -------------------------------------------------
    console.log('votes (v3 reads as BigInt)')
    const voteTypes = await users.aggregate<TypeBucket>([
      { $group: { _id: { $type: '$votes' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray()
    console.log(`  types: ${voteTypes.map((t) => `${t._id}×${t.count}`).join(', ')}`)
    const badVoteTypes = voteTypes.filter(
      (t) => !['double', 'int', 'long', 'missing'].includes(t._id),
    )
    for (const t of badVoteTypes) {
      block(`${t.count} doc(s) with votes of BSON type '${t._id}' — BigInt cast will throw`)
    }
    const fractional = await users.countDocuments({
      $expr: {
        $and: [
          { $in: [{ $type: '$votes' }, ['double', 'int', 'long']] },
          { $ne: ['$votes', { $trunc: '$votes' }] },
        ],
      },
    })
    if (fractional > 0) {
      block(`${fractional} doc(s) with fractional votes — BigInt cast will throw (round them first)`)
    } else if (badVoteTypes.length === 0) {
      ok('all votes are integral numbers (castable to BigInt)')
    }
    const negative = await users.countDocuments({ votes: { $lt: 0 } })
    if (negative > 0) warn(`${negative} doc(s) with negative votes`)

    // --- state ---------------------------------------------------------------
    console.log('state')
    const states = await users.aggregate<TypeBucket>([
      { $group: { _id: '$state', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray()
    console.log(`  values: ${states.map((s) => `${s._id ?? '(missing)'}×${s.count}`).join(', ')}`)
    for (const s of states) {
      if (s._id !== null && s._id !== undefined && !ALLOWED_STATES.has(String(s._id))) {
        block(`${s.count} doc(s) with unknown state '${s._id}' — v3 enum is WaitNothing|Submited|Rework`)
      }
    }
    if (states.every((s) => s._id === null || s._id === undefined || ALLOWED_STATES.has(String(s._id)))) {
      ok('all states fit the v3 enum (missing defaults to WaitNothing)')
    }

    // --- wallet: the unique sparse index landmine -----------------------------
    console.log('wallet')
    const walletDupes = await users.aggregate([
      { $match: { wallet: { $type: 'string' } } },
      { $group: { _id: '$wallet', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 10 },
    ]).toArray()
    if (walletDupes.length > 0) {
      block(`duplicate wallets (v3 unique sparse index will fail to build): ${walletDupes.map((d) => `${d._id}×${d.count}`).join(', ')}`)
    } else {
      ok('no duplicate wallets')
    }
    const withWallet = await users.countDocuments({ wallet: { $type: 'string' } })
    console.log(`  ${withWallet} doc(s) with a wallet`)

    // --- misc warnings ---------------------------------------------------------
    console.log('misc')
    const mintedCount = await users.countDocuments({ minted: true })
    console.log(`  minted: ${mintedCount}`)
    const stuck = await users.countDocuments({ mintingInProgress: true })
    if (stuck > 0) warn(`${stuck} doc(s) stuck with mintingInProgress=true — clear before cutover`)
    const unnamed = await users.countDocuments({
      name: { $not: { $type: 'string' } },
    })
    if (unnamed > 0) {
      warn(`${unnamed} doc(s) without a name — v3 backfills it on their next login`)
    }
    const withAvatar = await users.countDocuments({ avatar: { $type: 'string' } })
    const withImage = await users.countDocuments({ image: { $type: 'string' } })
    if (withAvatar + withImage > 0) {
      warn(`${withAvatar} avatar / ${withImage} image path(s) reference files under ./data on the OLD host — carry the data/ folder over or let users re-pick`)
    }

    // --- unexpected fields (sample) --------------------------------------------
    const knownFields = new Set([
      '_id', 'id', 'language', 'languageSelected', 'state', 'votes', 'referalId',
      'name', 'description', 'nftDescription', 'image', 'avatar', 'wallet',
      'lastSendedPlace', 'minted', 'mintingInProgress', 'mintedAt', 'diceWinner',
      'selectedUser', 'avatarNumber', 'nftImage', 'nftJson', 'nftUrl',
      'customDescription', 'positivePrompt', 'negativePrompt', 'strength',
      'scale', 'steps', 'preset', 'sampler', 'createdAt', 'updatedAt', '__v',
    ])
    const sample = await users.find({}).limit(SAMPLE_SIZE).toArray()
    const unknownFieldCounts = new Map<string, number>()
    for (const doc of sample) {
      for (const key of Object.keys(doc)) {
        if (!knownFields.has(key)) {
          unknownFieldCounts.set(key, (unknownFieldCounts.get(key) ?? 0) + 1)
        }
      }
    }
    if (unknownFieldCounts.size > 0) {
      warn(`fields not in the v3 model (sample of ${sample.length}): ${[...unknownFieldCounts.entries()].map(([k, n]) => `${k}×${n}`).join(', ')} — harmless (mongoose ignores them) but worth knowing`)
    } else {
      ok(`no unknown fields in a ${sample.length}-doc sample`)
    }

    // --- sibling collections ----------------------------------------------------
    console.log('balances / claims')
    const balances = await db.collection('balances').countDocuments()
    console.log(`  balances: ${balances} row(s)${balances === 0 ? ' — v3 seeds Initial rows from votes at first boot' : ''}`)
    const claimDupes = await db.collection('claims').aggregate([
      { $group: { _id: '$userId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $count: 'groups' },
    ]).toArray()
    const dupGroups = (claimDupes[0]?.groups as number | undefined) ?? 0
    if (dupGroups > 0) {
      warn(`${dupGroups} duplicate claim group(s) — the boot migration (ensureClaimUniquenessMigration) will merge them`)
    } else {
      ok('no duplicate claims')
    }
  } finally {
    await connection.close()
  }

  console.log('')
  if (blocking > 0) {
    console.error(`NOT SAFE TO CUT OVER: ${blocking} blocking finding(s), ${warnings} warning(s)`)
    process.exit(1)
  }
  console.log(`Safe to cut over: 0 blocking findings, ${warnings} warning(s)`)
}

run().catch((err) => {
  console.error('Checker crashed:', err)
  process.exit(1)
})
