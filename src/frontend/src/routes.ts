import ClaimComponent from './components/ClaimComponent.vue'
import ClickerComponent from './components/ClickerComponent.vue'
import CNFTComponent from './components/CNFT.vue'
import FAQComponent from './components/FAQ.vue'
import LeaderboardComponent from './components/LeaderboardComponent.vue'
import NotFoundComponent from './components/NotFound.vue'
import ExchangeComponent from './components/SatoshiExchange.vue'
import SatoshiMiningComponent from './components/SatoshiMining.vue'

export interface MenuRoute {
    path: string
    name: string
    emoji: string
    showInMenu: boolean
    component: any
}

// RESERVED: /cnfts /api
export const menuRoutes: MenuRoute[] = [
    { path: '/', name: 'ClaimPage', emoji: '🏠', showInMenu: true, component: ClaimComponent },
    { path: '/leaderboard', name: 'LeaderboardPage', emoji: '🏆', showInMenu: true, component: LeaderboardComponent },
    { path: '/exchange', name: 'ExchangePage', emoji: '💰', showInMenu: true, component: ExchangeComponent },
    { path: '/satoshi', name: 'SatoshiMiningPage', emoji: '⛏️', showInMenu: true, component: SatoshiMiningComponent },
    { path: '/cnft', name: 'CNFTPage', emoji: '🎨', showInMenu: true, component: CNFTComponent },

    { path: '/faq', name: 'FAQPage', emoji: '🤔', showInMenu: false, component: FAQComponent },
    { path: '/clicker', name: 'ClickerPage', emoji: '🖱️', showInMenu: false, component: ClickerComponent },
]

export const vueRoutes = [
    ...menuRoutes.map(r => ({
        path: r.path,
        name: r.name,
        component: r.component,
    })),
    { path: '/:pathMatch(.*)*', component: NotFoundComponent },
]
