FROM node:22.15.0-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@10.22.0

WORKDIR /app

COPY . .

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm -w packages:build
RUN pnpm build --filter=api
# TODO: Move pnpm deploy to turbo prune workflow
RUN pnpm deploy --filter=api pnpm-deploy-output --prod --legacy

FROM node:22.15.0-alpine
WORKDIR /app
COPY --from=base /app/pnpm-deploy-output /app
# The Workflow builder's nested .gitignore excludes these bundles from pnpm deploy.
COPY --from=base /app/apps/api/dist/workflow /app/dist/workflow
RUN test -s /app/dist/workflow/manifest.json \
    && test -s /app/dist/workflow/steps.mjs \
    && test -s /app/dist/workflow/workflows.mjs

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
    libreoffice \
    && rm -rf /var/cache/apk/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN chmod +x /app/entrypoint.sh

ENTRYPOINT [ "/app/entrypoint.sh" ]
