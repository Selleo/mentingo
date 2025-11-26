FROM node:20.15.0-alpine AS base

LABEL org.opencontainers.image.source=https://github.com/Selleo/mentingo
LABEL org.opencontainers.image.description="Unlock the Power of Learning with AI mentor."

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@9.15.2

WORKDIR /app

COPY . .

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install
RUN pnpm --filter="@repo/shared" run build
RUN pnpm --filter="@repo/prompts" run build
RUN pnpm build --filter=api
# TODO: Move pnpm deploy to turbo prune workflow
RUN pnpm deploy --filter=api pnpm-deploy-output --prod

FROM node:20.15.0-alpine
WORKDIR /app
COPY --from=base /app/pnpm-deploy-output /app

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    xvfb \
    libc6-compat \
    && rm -rf /var/cache/apk/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN chmod +x /app/entrypoint.sh

ENTRYPOINT [ "/app/entrypoint.sh" ]
