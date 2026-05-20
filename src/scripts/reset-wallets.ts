#!/usr/bin/env tsx
//
// One-time hard reset of wallet bindings.
//
// Before this commit, /api/auth/set-wallet trusted whatever address the
// caller submitted alongside their initData — an attacker with stolen
// initData could bind any wallet to a victim's account. Now bindings require
// a TON Connect ton_proof signature, but pre-existing rows have no such
// proof. This script wipes every `User.wallet` so every user re-binds with
// proof.
//
// Run once against production after the new code is deployed:
//
//     MONGO="mongodb://..." npx tsx src/scripts/reset-wallets.ts
//
// Idempotent: a second run finds no wallets to clear and reports 0.
import process from 'node:process'
import { getModelForClass } from '@typegoose/typegoose'
import mongoose from 'mongoose'
import { User } from '#root/common/models/User'

const mongoUrl = process.env.MONGO
if (!mongoUrl) {
  console.error('MONGO env var is required')
  process.exit(1)
}

await mongoose.connect(mongoUrl)
try {
  const UserModel = getModelForClass(User)
  const matched = await UserModel.countDocuments({ wallet: { $exists: true } })
  const result = await UserModel.updateMany(
    { wallet: { $exists: true } },
    { $unset: { wallet: '' } },
  )
  console.log(
    `Reset wallets: matched=${matched} modified=${result.modifiedCount ?? 0}`,
  )
} finally {
  await mongoose.disconnect()
}
