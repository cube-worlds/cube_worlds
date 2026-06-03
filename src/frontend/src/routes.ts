import CastleComponent from './components/CastleComponent.vue'
import ClaimComponent from './components/ClaimComponent.vue'
import ClickerComponent from './components/ClickerComponent.vue'
import CNFTComponent from './components/CNFT.vue'
import ExpeditionComponent from './components/ExpeditionComponent.vue'
import FAQComponent from './components/FAQ.vue'
import LeaderboardComponent from './components/LeaderboardComponent.vue'
import NotFoundComponent from './components/NotFound.vue'
import ExchangeComponent from './components/SatoshiExchange.vue'
import SatoshiMiningComponent from './components/SatoshiMining.vue'
import TournamentComponent from './components/TournamentComponent.vue'
import WalletComponent from './components/WalletComponent.vue'

export interface MenuRoute {
  path: string
  name: string
  emoji: string
  showInMenu: boolean
  component: any
}

// RESERVED: /cnfts /api
export const menuRoutes: MenuRoute[] = [
  {
    path: '/',
    name: 'CastlePage',
    emoji: '🏰',
    showInMenu: true,
    component: CastleComponent,
  },
  {
    path: '/claim',
    name: 'ClaimPage',
    emoji: '🏠',
    showInMenu: false,
    component: ClaimComponent,
  },
  {
    path: '/leaderboard',
    name: 'LeaderboardPage',
    emoji: '🏆',
    showInMenu: true,
    component: LeaderboardComponent,
  },
  {
    path: '/exchange',
    name: 'ExchangePage',
    emoji: '💰',
    showInMenu: true,
    component: ExchangeComponent,
  },
  {
    path: '/mining',
    name: 'SatoshiMiningPage',
    emoji: '⛏️',
    showInMenu: true,
    component: SatoshiMiningComponent,
  },
  {
    path: '/expeditions',
    name: 'DispatchPage',
    emoji: '⚔️',
    showInMenu: true,
    component: ExpeditionComponent,
  },
  {
    path: '/tournament',
    name: 'TournamentPage',
    emoji: '🏅',
    showInMenu: true,
    component: TournamentComponent,
  },
  {
    path: '/wallet',
    name: 'WalletPage',
    emoji: '👛',
    showInMenu: true,
    component: WalletComponent,
  },
  {
    path: '/cnft',
    name: 'CNFTPage',
    emoji: '🎨',
    showInMenu: false,
    component: CNFTComponent,
  },

  {
    path: '/faq',
    name: 'FAQPage',
    emoji: '🤔',
    showInMenu: false,
    component: FAQComponent,
  },
  {
    path: '/clicker',
    name: 'ClickerPage',
    emoji: '🖱️',
    showInMenu: false,
    component: ClickerComponent,
  },
]

export const vueRoutes = [
  ...menuRoutes.map((r) => ({
    path: r.path,
    name: r.name,
    component: r.component,
  })),
  { path: '/:pathMatch(.*)*', component: NotFoundComponent },
]
