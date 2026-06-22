FROM node:22.13.0-bookworm-slim

RUN npm install -g pnpm@11.5.0

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/contracts/tsconfig.json packages/contracts/
COPY packages/core/package.json packages/core/
COPY packages/core/tsconfig.json packages/core/
COPY packages/utils/package.json packages/utils/
COPY packages/utils/tsconfig.json packages/utils/
COPY packages/session-control/package.json packages/session-control/
COPY packages/session-control/tsconfig.json packages/session-control/
COPY apps/worker-llm/package.json apps/worker-llm/
COPY apps/worker-llm/tsconfig.json apps/worker-llm/
COPY apps/api/package.json apps/api/
COPY apps/api/prisma.config.ts apps/api/
COPY apps/api/prisma apps/api/prisma

ENV DATABASE_URL=postgresql://metamorph:metamorph@postgres:5432/metamorph

RUN pnpm install --frozen-lockfile \
  --filter @metamorph/worker-llm... \
  --filter @metamorph/api...

COPY packages/contracts packages/contracts
COPY packages/core packages/core
COPY packages/utils packages/utils
COPY packages/session-control packages/session-control
COPY apps/worker-llm apps/worker-llm

RUN pnpm --filter @metamorph/worker-llm exec prisma generate \
      --schema=../api/prisma/schema.prisma \
  && pnpm --filter @metamorph/contracts build \
  && pnpm --filter @metamorph/utils build \
  && pnpm --filter @metamorph/session-control build \
  && pnpm --filter @metamorph/core build

ENTRYPOINT ["pnpm", "--filter", "@metamorph/worker-llm", "exec", "tsx", "src/main.ts"]
CMD ["consume"]
