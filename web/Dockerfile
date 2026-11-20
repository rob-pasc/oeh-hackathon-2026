# syntax=docker/dockerfile:1
# Build from the repository root: docker build -f web/Dockerfile .

# Debian (glibc) rather than Alpine, because Vite and Tailwind load native bindings
# and the lockfile is produced on glibc machines.
FROM node:24-slim AS build
WORKDIR /app

# Install dependencies first so this layer is cached until a manifest changes.
# All workspace manifests are copied so npm ci sees the lockfile's full workspace set.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY web/package.json web/
# web imports shared/ from source through Vite aliases, so it needs shared's dependencies too.
RUN npm ci --workspace web --workspace shared

COPY shared shared
COPY web web

# Baked into the bundle at build time. "mock" serves the fictional fixtures; "live" calls /api.
ARG VITE_API_MODE=mock
ENV VITE_API_MODE=$VITE_API_MODE
RUN npm run build --workspace web

FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
