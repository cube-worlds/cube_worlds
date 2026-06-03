import { findUnmintedHeroes, markHeroMinted } from '#root/common/models/Hero'
import { logger } from '#root/logger'
import {
  buildHeroMintRunner,
  DEFAULT_HERO_MINT_BATCH,
} from './hero-mint'
import { mintHeroNft } from './hero-nft-client'

// Config-bound wiring: the pure hero-mint.ts stays config/chain-free for tests;
// this composer injects the operator-funded chain mint, mirroring
// castle-mint-runner.ts.
const heroMintRunner = buildHeroMintRunner({
  batchSize: DEFAULT_HERO_MINT_BATCH,
  findUnmintedHeroes: limit => findUnmintedHeroes(limit) as never,
  mintHeroNft,
  markHeroMinted,
  logInfo: logger.info.bind(logger),
  logError: logger.error.bind(logger),
})

export default heroMintRunner
