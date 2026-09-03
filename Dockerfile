# --- builder: full deps, builds the React app and the static landing ---------
FROM node:22-bookworm-slim AS builder

WORKDIR /usr/src

COPY package*.json ./
RUN npm ci

COPY . .

# React Mini App → src/frontend/dist (served under /game)
RUN npm --prefix src/frontend ci
RUN npm --prefix src/frontend run build

# Static landing → src/landing/dist (served at the root)
RUN npm run build:landing

# The runtime never needs the frontend toolchain (vite is imported from
# src/frontend/node_modules only in development mode).
RUN rm -rf src/frontend/node_modules

# --- runner: production deps only (tsx is a prod dep and runs src directly) --
FROM node:22-bookworm-slim AS runner

WORKDIR /usr/src
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /usr/src/src ./src
COPY --from=builder /usr/src/locales ./locales
COPY --from=builder /usr/src/tsconfig.json ./tsconfig.json

# Generation sources and drafts are written to ./data at runtime.
RUN mkdir -p data && chown node:node data

USER node

EXPOSE 80
CMD ["npm", "run", "start:force"]
