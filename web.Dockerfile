FROM node:24.14.1-alpine AS build
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

ARG VITE_API_URL
ARG VITE_APP_URL
ARG VITE_STRIPE_PUBLISHABLE_KEY
ARG VITE_SENTRY_DSN
ARG VITE_GOOGLE_OAUTH_ENABLED
ARG VITE_MICROSOFT_OAUTH_ENABLED
ARG VITE_SLACK_OAUTH_ENABLED
ARG VITE_POSTHOG_KEY
ARG VITE_POSTHOG_HOST

ENV VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY

RUN npm install -g pnpm@9.15.2

WORKDIR /app

COPY . .

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install
RUN pnpm -w packages:build
RUN pnpm build --filter=web
# TODO: Move pnpm deploy to turbo prune workflow
RUN pnpm deploy --filter=web pnpm-deploy-output --prod

FROM nginx:1.28-alpine
COPY ./apps/web/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/apps/web/build/client /usr/share/nginx/html
