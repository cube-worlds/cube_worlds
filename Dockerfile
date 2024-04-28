FROM node:lts-slim AS base

# Create app directory
WORKDIR /usr/src

FROM base AS builder

# Files required by npm install
COPY package*.json ./

# Install app dependencies
RUN npm ci

# Bundle app source
COPY . .

RUN npm --prefix src/web ci && npm --prefix src/web run build

# Type check app
RUN npm run typecheck


FROM base AS runner

# Files required by npm install
COPY package*.json ./

# Install only production app dependencies
RUN npm ci --omit=dev

# Bundle app source
COPY . .

RUN npm --prefix src/web ci --omit=dev && npm --prefix src/web run build

USER node

EXPOSE 80
CMD ["npm", "run", "start:force"]
