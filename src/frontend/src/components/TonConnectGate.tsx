import { TonConnectUIProvider } from '@tonconnect/ui-react'

// The whole @tonconnect/{ui,sdk} stack is ~400 kB minified — two thirds of the
// bundle — and nothing on the boot path (title → login → hub) needs it. Keeping
// the provider behind this default export lets App.tsx React.lazy() it, so the
// weight only lands when a wallet screen is actually reached.
//
// Default export on purpose: React.lazy resolves `.default`.
export default function TonConnectGate({ children }: { children: React.ReactNode }) {
  return (
    <TonConnectUIProvider manifestUrl={`${window.location.origin}/tonconnect-manifest.json`}>
      {children}
    </TonConnectUIProvider>
  )
}
