FROM node:20-bookworm-slim AS base

# Create app directory
WORKDIR /usr/src



FROM base AS runner

# Files required by npm install
COPY package*.json ./

# Install only production app dependencies
RUN npm ci --omit=dev

# Bundle app source
COPY . .

# Build frontend
RUN npm --prefix src/frontend ci
RUN npm --prefix src/frontend run build:frontend

USER node

EXPOSE 80
CMD ["npm", "run", "start:force"]
