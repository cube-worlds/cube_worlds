import { buildCubeBridgeHandler, createDefaultDependencies } from './cube-bridge-handler'
import { cubeVaultAddress, sendCubeJetton } from './cube-jetton-client'

// Inject the config+chain-bound fields the pure handler left unwired.
const cubeBridgeHandler = buildCubeBridgeHandler({
  ...createDefaultDependencies(),
  vaultAddress: () => cubeVaultAddress().toString(),
  sendCubeJetton,
})

export default cubeBridgeHandler
