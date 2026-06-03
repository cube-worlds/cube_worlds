import { findUnmintedEquipment, markEquipmentMinted } from '#root/common/models/Equipment'
import { logger } from '#root/logger'
import {
  buildEquipmentMintRunner,
  DEFAULT_EQUIPMENT_MINT_BATCH,
} from './equipment-mint'
import { mintEquipmentNft } from './equipment-nft-client'

// Config-bound wiring: the pure equipment-mint.ts stays config/chain-free for
// tests; this composer injects the operator-funded chain mint, mirroring
// hero-mint-runner.ts.
const equipmentMintRunner = buildEquipmentMintRunner({
  batchSize: DEFAULT_EQUIPMENT_MINT_BATCH,
  findUnmintedEquipment: limit => findUnmintedEquipment(limit) as never,
  mintEquipmentNft,
  markEquipmentMinted,
  logInfo: logger.info.bind(logger),
  logError: logger.error.bind(logger),
})

export default equipmentMintRunner
