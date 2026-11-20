# syntax=docker/dockerfile:1
# Build from the repository root: docker build -f server/Dockerfile .
#
# Prepared ahead of the HTTP API: the server has no entry point yet, so this image builds but
# cannot run until feature 001 adds server/src/main.ts. That entry point should listen on $PORT
# and keep its SQLite database under $LEAAF_DATA_DIR.

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
ENV NODE_ENV=production \
    PORT=3000 \
    LEAAF_DATA_DIR=/data
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
