import { findUnmintedCastles, markCastleMinted } from '#root/common/models/Castle'
import { logger } from '#root/logger'
import {
  buildCastleMintRunner,
  DEFAULT_CASTLE_MINT_BATCH,
} from './castle-mint'
import { mintCastleNft } from './castle-nft-client'

// Config-bound wiring: the pure castle-mint.ts stays config/chain-free for
// tests; this composer injects the operator-funded chain mint, mirroring
// expedition-settlement-runner.ts.
const castleMintRunner = buildCastleMintRunner({
  batchSize: DEFAULT_CASTLE_MINT_BATCH,
  findUnmintedCastles: limit => findUnmintedCastles(limit) as never,
  mintCastleNft,
  markCastleMinted,
  logInfo: logger.info.bind(logger),
  logError: logger.error.bind(logger),
})

export default castleMintRunner
