# syntax=docker/dockerfile:1.7
# Multi-target build: `--target api` or `--target workers`. Both share one compiled bundle.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine AS runtime-base
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
USER node

FROM runtime-base AS api
ENV PORT=8080 OTEL_SERVICE_NAME=parley-api
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/health/live > /dev/null || exit 1
CMD ["node", "--import", "./dist/infrastructure/observability/instrumentation.js", "dist/api/server.js"]

FROM runtime-base AS workers
ENV PORT=8081 OTEL_SERVICE_NAME=parley-workers
EXPOSE 8081
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8081/health/live > /dev/null || exit 1
CMD ["node", "--import", "./dist/infrastructure/observability/instrumentation.js", "dist/workers/main.js"]
