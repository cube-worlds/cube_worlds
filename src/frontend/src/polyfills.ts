/**
 * Browser polyfills, loaded as the first module entry in index.html.
 *
 * @ton/core (Cell, beginCell, Address) expects a global Buffer. Vite no
 * longer injects one via esbuild optimizeDeps plugins (vite 8 / rolldown),
 * so provide the `buffer` npm package explicitly before any TON code runs.
 *
 * The node-centric lint rules below don't apply: this file runs in the
 * browser, where `node:buffer` doesn't resolve and there is no built-in
 * global Buffer to prefer.
 */
/* eslint-disable unicorn/prefer-node-protocol, node/prefer-global/buffer */
import { Buffer } from 'buffer'

if (globalThis.Buffer === undefined) {
  globalThis.Buffer = Buffer
}
