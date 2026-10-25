FROM node:22-alpine AS deps

WORKDIR /app

# Сначала только манифесты — слой с зависимостями кэшируется,
# пока не изменился package-lock.json
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine

ENV NODE_ENV=production

WORKDIR /app

# Приложение не должно работать от root
RUN addgroup -S app && adduser -S app -G app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server.js db.js ./
COPY public ./public

USER app

EXPOSE 3000

# Проверка живости процесса (Node 18+ содержит fetch)
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
