FROM node:22-alpine AS web-build

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

RUN corepack enable && pnpm install --filter @cja/web... --frozen-lockfile=false

COPY apps/web ./apps/web
COPY apps/api/public/styles.css ./apps/api/public/styles.css

RUN pnpm --filter @cja/web build

FROM node:22-alpine AS runtime

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json

RUN corepack enable && pnpm install --filter @cja/api... --prod --frozen-lockfile=false

COPY apps/api ./apps/api
COPY --from=web-build /app/apps/web/dist ./apps/web/dist

ENV NODE_ENV=production
ENV PORT=8080
ENV PUBLIC_DIR=/app/apps/web/dist

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/api/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"

CMD ["node", "apps/api/src/server.js"]
