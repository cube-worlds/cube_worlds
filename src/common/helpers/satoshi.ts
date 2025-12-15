import type TonWeb from 'tonweb'
import { useRetry } from '../../frontend/src/composables/useRetry'
import { countAllBalances } from '../models/User'

export async function getSatoshiWalletAddress(isDev: boolean) {
    return isDev
        ? 'kQDnOgk7w_OC29bZgkSel0DRpXL8yv8M1EqhtIhjO0wWps1u'
        : 'EQCd7tILlcnS89uI0OD4Zzz7yQHGLhGzBedk88PKGEbmv7zP'
}

export async function convertCubeToSatoshi(tonweb: TonWeb, isDev: boolean, cubes: number) {
    const satoshiWalletAddress = await getSatoshiWalletAddress(isDev)

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
