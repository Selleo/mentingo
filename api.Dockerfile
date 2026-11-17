FROM node:22.15.0-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV TURBO_TELEMETRY_DISABLED=1
RUN npm install -g pnpm@10.22.0 turbo@2.3.3
WORKDIR /app

FROM base AS pruner
COPY . .
RUN turbo prune api --docker

FROM base AS builder
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm build --filter=api
RUN pnpm deploy --filter=api pnpm-deploy-output --prod --legacy --prefer-offline

FROM node:22.15.0-alpine AS runtime
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto \
    xvfb \
    libc6-compat \
    ffmpeg \
    libreoffice

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    UV_THREADPOOL_SIZE=16

WORKDIR /app
COPY --from=builder /app/pnpm-deploy-output /app
COPY --from=builder /app/apps/api/dist/workflow /app/dist/workflow
RUN test -s /app/dist/workflow/manifest.json \
    && test -s /app/dist/workflow/steps.mjs \
    && test -s /app/dist/workflow/workflows.mjs \
    && chmod +x /app/entrypoint.sh

ENTRYPOINT [ "/app/entrypoint.sh" ]
