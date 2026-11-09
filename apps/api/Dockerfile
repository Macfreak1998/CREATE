FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm install

FROM deps AS dev
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
# tsx laedt @b2b/shared ueber "main" aus dist, nicht aus dem gemounteten src.
# Deshalb dist bei jedem Start aus dem aktuellen Quellstand neu bauen.
RUN npm --workspace packages/shared run build
WORKDIR /app/apps/api
EXPOSE 4000
CMD sh -c "cd /app && npm --workspace packages/shared run build && npm --workspace @b2b/api run dev"

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm --workspace packages/shared run build
RUN npm --workspace apps/api run build

FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json* ./
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
RUN npm install --omit=dev
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/packages/shared/dist packages/shared/dist
# SQL-Migrationen + Entrypoint fuer Auto-Migration beim Start.
COPY --from=build /app/apps/api/src/db/migrations apps/api/migrations
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4000}/health" >/dev/null 2>&1 || exit 1
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "apps/api/dist/server.js"]
