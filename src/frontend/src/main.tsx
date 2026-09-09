import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './theme.css'

// TonConnectUIProvider used to live here, which pulled the whole TON Connect
// stack into the entry chunk. It now sits in the lazy TonConnectGate that
// App.tsx mounts around the wallet screens only.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
