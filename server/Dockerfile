# syntax=docker/dockerfile:1
# Build from the repository root: docker build -f server/Dockerfile .
#
# Runs server/src/main.ts; its variables are listed in server/.env.example. The image also
# contains the scanner downloads: Windows and Linux are built here, and the macOS app is copied
# from scanner/macos-release/ when CI put it there (it can only be built on a Mac, feature 007).

# Windows scanner release build. The backend URL is compiled in; it holds no secrets (feature 005
# FR-007). Pure Go, so it cross-compiles without cgo. -H windowsgui: the scanner is a window
# (feature 001 FR-014), so no console window may open behind it.
FROM golang:1.26 AS scanner
ARG SCANNER_BACKEND_URL=https://leaaf.green
ARG SCANNER_VERSION=0.0.0-dev
WORKDIR /src
COPY scanner/go.mod scanner/go.sum ./
RUN go mod download
COPY scanner .
RUN CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -trimpath \
      -ldflags "-s -w -H windowsgui -X main.backendURL=${SCANNER_BACKEND_URL} -X main.version=${SCANNER_VERSION}" \
      -o /out/leaaf-scanner.exe ./cmd/leaaf-scanner
# The macOS app from CI's macOS job, if present; without it the Mac download is 404.
RUN mkdir -p /out/macos && if [ -f macos-release/leaaf-scanner-macos.zip ]; then \
      cp macos-release/leaaf-scanner-macos.zip /out/macos/; fi

# Linux scanner release build (feature 007). The Gio window needs cgo and the X11/Wayland
# headers. Built on Ubuntu 22.04 so it runs on glibc 2.35 and later (Ubuntu 22.04, Debian 12,
# Fedora 36 and newer); the Go toolchain is copied from the official image.
FROM ubuntu:22.04 AS scanner-linux
ARG SCANNER_BACKEND_URL=https://leaaf.green
ARG SCANNER_VERSION=0.0.0-dev
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      ca-certificates gcc libc6-dev pkg-config libwayland-dev libx11-dev libx11-xcb-dev \
      libxkbcommon-x11-dev libgles2-mesa-dev libegl1-mesa-dev libffi-dev libxcursor-dev libvulkan-dev \
    && rm -rf /var/lib/apt/lists/*
COPY --from=golang:1.26 /usr/local/go /usr/local/go
ENV PATH=/usr/local/go/bin:$PATH
WORKDIR /src
COPY scanner/go.mod scanner/go.sum ./
RUN go mod download
COPY scanner .
RUN CGO_ENABLED=1 go build -trimpath \
      -ldflags "-s -w -X main.backendURL=${SCANNER_BACKEND_URL} -X main.version=${SCANNER_VERSION}" \
      -o /out/leaaf-scanner-linux ./cmd/leaaf-scanner

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
    DATABASE_PATH=/data/leaaf.sqlite \
    SCANNER_EXE_PATH=/app/scanner/leaaf-scanner.exe \
    SCANNER_LINUX_PATH=/app/scanner/leaaf-scanner-linux \
    SCANNER_MACOS_PATH=/app/scanner/macos/leaaf-scanner-macos.zip \
    CORPUS_INDEX_PATH=/app/corpus-index/corpus.sqlite
WORKDIR /app
COPY --from=prod-deps /app/node_modules node_modules
COPY --from=build-shared /app/shared/package.json shared/package.json
COPY --from=build-shared /app/shared/dist shared/dist
COPY shared/schemas shared/schemas
COPY server/package.json server/package.json
COPY server/src server/src
# Read at runtime relative to the sources (server/src/impact/table.ts, server/src/assessment/weights.ts).
COPY data data
COPY config config
COPY --from=scanner /out/leaaf-scanner.exe scanner/leaaf-scanner.exe
COPY --from=scanner /out/macos/ scanner/macos/
COPY --from=scanner-linux /out/leaaf-scanner-linux scanner/leaaf-scanner-linux
# The retrieval index is built at image build time, never per request (feature 002); an invalid
# corpus manifest fails the build.
COPY corpus corpus
COPY server/scripts server/scripts
RUN cd server && node scripts/corpus-ingest.ts
RUN mkdir -p /data && chown node:node /data
USER node
WORKDIR /app/server
EXPOSE 3000
# Node 24 runs the TypeScript sources directly (type stripping); there is no server build step.
CMD ["node", "src/main.ts"]
