# Chromium + system deps (matches playwright@1.60.0 in workspace)
FROM mcr.microsoft.com/playwright:v1.60.0-noble

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@11.5.0 --activate

WORKDIR /app

# Workspace manifests (layer cache)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/contracts/tsconfig.json packages/contracts/
COPY packages/core/package.json packages/core/
COPY packages/inventory/package.json packages/inventory/
COPY packages/utils/package.json packages/utils/
COPY packages/utils/tsconfig.json packages/utils/
COPY packages/session-control/package.json packages/session-control/
COPY packages/session-control/tsconfig.json packages/session-control/
COPY apps/worker-playwright/package.json apps/worker-playwright/
COPY apps/worker-playwright/tsconfig.json apps/worker-playwright/
COPY apps/api/package.json apps/api/
COPY apps/api/prisma.config.ts apps/api/
COPY apps/api/prisma apps/api/prisma

# prisma generate reads DATABASE_URL from prisma.config.ts at build time
ENV DATABASE_URL=postgresql://metamorph:metamorph@postgres:5432/metamorph

# api filter: @prisma/client must resolve from apps/api/generated/prisma
RUN pnpm install --frozen-lockfile \
  --filter @metamorph/worker-playwright... \
  --filter @metamorph/api...

COPY packages/contracts packages/contracts
COPY packages/core packages/core
COPY packages/inventory packages/inventory
COPY packages/utils packages/utils
COPY packages/session-control packages/session-control
COPY apps/worker-playwright apps/worker-playwright

RUN pnpm --filter @metamorph/worker-playwright exec prisma generate \
      --schema=../api/prisma/schema.prisma \
  && pnpm --filter @metamorph/contracts build \
  && pnpm --filter @metamorph/utils build \
  && pnpm --filter @metamorph/session-control build \
  && pnpm --filter @metamorph/inventory build:browser

ENTRYPOINT ["pnpm", "--filter", "@metamorph/worker-playwright", "exec", "tsx", "src/main.ts"]
CMD ["consume"]
