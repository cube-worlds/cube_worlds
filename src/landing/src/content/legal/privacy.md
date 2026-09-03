---
title: Privacy Policy — Cube Worlds
description: Privacy policy for Cube Worlds — what data we collect, how it is used, and how to contact us.
---

# Privacy Policy

_Last updated: 2026-07-13_

## Who we are

Cube Worlds is a Telegram Mini App game operated by Vladimir Babin ("we", "us", "our"). The game runs at **@cube_worlds_bot** on Telegram and is accessible via [cubeworlds.club](https://cubeworlds.club).

## Data we collect

When you play Cube Worlds, we collect and store the following information:

- **Telegram identity.** Your Telegram user ID and username, passed by the Telegram Mini App API when you open the bot. We do not receive your phone number or email address from Telegram.
- **TON wallet address.** If you choose to connect a TON wallet (required for NFT minting and donation crediting), we store the wallet address after you supply a cryptographic proof of ownership (ton_proof). You are never required to share a seed phrase or private key.
- **Source and generated images.** The Telegram profile photo you select or the image you upload becomes the source for NFT generation and is stored on our server, along with the generated drafts, until your pass is minted or you replace them.
- **Gameplay and ledger records.** Your in-game state — $CUBE balance, claim streak, referral relations, NFT/mint status, and the append-only $CUBE ledger — is stored in our database to operate the game.
- **Transaction records.** Telegram Stars top-up charges (including Telegram's payment charge ID) and TON donation amounts credited to your account.
- **Technical logs.** Standard server request logs (IP address, timestamp, endpoint) retained for up to 30 days for security and debugging.

## How we use your data

We use the data described above solely to:

- Operate and personalise your Cube Worlds gameplay experience.
- Process payments.
- Prevent abuse, fraud, and cheating.
- Comply with legal obligations if required.

## Data sharing

We do **not** sell, rent, or trade your personal data to third parties. We share data only as needed to operate the game:

- **Telegram** — Stars payments are processed entirely by Telegram; we receive only the payment confirmation.
- **Stability AI / OpenAI** — your selected source image and display name are sent to generate the pixel art and its description. No other personal identifiers are included in these requests.
- **Pinata (IPFS)** — approved pass images and metadata are pinned to IPFS as part of NFT minting; anything minted on-chain is public by nature.

## Data retention

We retain your game account data for as long as your account is active. If you wish to have your data deleted, contact us at @babin on Telegram.

## Security

Game state is stored in a hosted MongoDB database with access controls. Wallet binding uses cryptographic proof (Ed25519 signature over a stateless HMAC nonce) to verify wallet ownership. We do not store private keys or seed phrases.

## Children

Cube Worlds is not directed at children under 13. If you believe a child has provided personal information, contact us at @babin and we will delete it.

## Changes

We may update this policy. Material changes will be announced via @cube_worlds_bot. Continued use of the game after a change constitutes acceptance.

## Contact

Questions about this policy: **@babin** on Telegram.
