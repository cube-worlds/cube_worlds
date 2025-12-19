import type TonWeb from 'tonweb'
import { Address } from '@ton/core'
import { useRetry } from '../../frontend/src/composables/useRetry'
import { countAllBalances } from '../models/User'

export function getSatoshiWalletAddress(isDev: boolean): {
    isBounceable: boolean
    isTestOnly: boolean
    address: Address
} {
    return Address.parseFriendly(
        isDev
            ? 'kQDnOgk7w_OC29bZgkSel0DRpXL8yv8M1EqhtIhjO0wWps1u'
            : 'EQCd7tILlcnS89uI0OD4Zzz7yQHGLhGzBedk88PKGEbmv7zP',
    )
}

export function getSatoshiJettonMasterAddress(isDev: boolean): {
    isBounceable: boolean
    isTestOnly: boolean
    address: Address
} {
    return Address.parseFriendly(isDev
        ? 'kQAHVZTw1JlSNYR8OyU2ho5tqx3jtJYrkUiKEHmLZklAhzA-'
        : 'EQCkdx5PSWjj-Bt0X-DRCfNev6ra1NVv9qqcu-W2-SaToSHI')
}

export async function convertCubeToSatoshi(tonweb: TonWeb, isDev: boolean, cubes: number): Promise<number> {
    const satoshiWalletAddress = getSatoshiWalletAddress(isDev).address.toString()
    const { retry } = useRetry()
    const res = await retry(() =>
        tonweb.provider.call2(satoshiWalletAddress, 'get_wallet_data'), 3, 500)
    if (!res) {
        throw new Error('Failed to fetch total SATOSHI supply')
    }
    const allCubes = await countAllBalances()
    const allSatoshi = res[0]
    const r = (cubes / allCubes) * allSatoshi
    return Math.floor(Number.isFinite(r) ? r : 0)
}
