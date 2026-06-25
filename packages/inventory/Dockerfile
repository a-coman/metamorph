# Chromium + system deps for Playwright (matches packages/inventory playwright version)
FROM mcr.microsoft.com/playwright:v1.60.0-noble

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@11.5.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/inventory/package.json packages/inventory/

RUN pnpm install --frozen-lockfile --filter @metamorph/inventory...

COPY packages/core packages/core
COPY packages/inventory packages/inventory

RUN pnpm --filter @metamorph/inventory build:browser

CMD ["pnpm", "--filter", "@metamorph/inventory", "capture", "https://amazon.es", "/app/tmp/inventory"]
