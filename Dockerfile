FROM node:24-bookworm AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --include=dev
COPY backend/ backend/
COPY frontend/ frontend/
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=4000 DB_PATH=/var/lib/futapp/portal.db TZ=America/Bogota
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/src/adapters/out/persistence/schema.sql ./backend/src/adapters/out/persistence/schema.sql
COPY --from=build /app/frontend/dist ./frontend/dist
COPY scripts/backup.mjs scripts/restore.mjs ./scripts/
RUN mkdir -p /var/lib/futapp && chown node:node /var/lib/futapp
USER node
WORKDIR /app/backend
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
