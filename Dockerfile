# syntax=docker/dockerfile:1.7

# Install production dependencies in a full Debian image so native packages
# such as argon2 can compile when a prebuilt binary is unavailable.
FROM node:24-bookworm AS dependencies

WORKDIR /app/server

# Copy dependency manifests first so Docker can reuse this layer when only
# application source files change.
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force


# Keep compilers and package-manager caches out of the runtime image.
FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app/server

COPY --from=dependencies --chown=node:node /app/server/node_modules ./node_modules
COPY --chown=node:node server/ ./
COPY --chown=node:node client/ /app/client/

# The official Node image provides this unprivileged account.
USER node

# Railway injects PORT at runtime; 3000 documents the local/default port.
EXPOSE 3000

CMD ["node", "src/server.js"]
