# syntax=docker/dockerfile:1
# Build from the repository root: docker build -f server/Dockerfile .
#
# Runs server/src/main.ts; its variables are listed in server/.env.example.

FROM node:24-slim AS deps
WORKDIR /app
# All workspace manifests are copied so npm ci sees the lockfile's full workspace set.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY web/package.json web/

# shared/ is consumed as compiled JS (its package exports point at dist/), so build it first.
FROM deps AS build-shared
RUN npm ci --workspace shared
COPY shared shared
RUN npm run build --workspace shared

# Production dependencies only. @leaaf/shared is a workspace symlink to ../shared.
FROM deps AS prod-deps
RUN npm ci --workspace server --workspace shared --omit=dev

FROM node:24-slim
# HOST must be 0.0.0.0 so the published port reaches the server; main.ts defaults to loopback.
# The database lives on the /data volume, which is writable by the node user.
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATABASE_PATH=/data/leaaf.sqlite
WORKDIR /app
COPY --from=prod-deps /app/node_modules node_modules
COPY --from=build-shared /app/shared/package.json shared/package.json
COPY --from=build-shared /app/shared/dist shared/dist
COPY shared/schemas shared/schemas
COPY server/package.json server/package.json
COPY server/src server/src
# Read at runtime relative to the sources (server/src/impact/table.ts).
COPY data data
RUN mkdir -p /data && chown node:node /data
USER node
WORKDIR /app/server
EXPOSE 3000
# Node 24 runs the TypeScript sources directly (type stripping); there is no server build step.
CMD ["node", "src/main.ts"]
