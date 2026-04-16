# Multi-stage build for a small final image
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* package-lock.json* ./
RUN \
  if [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  else npm install; \
  fi

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Non-root user for safer deployments
RUN addgroup -g 1001 -S app && adduser -S app -u 1001 && chown -R app:app /app
USER app

EXPOSE 3000
CMD ["node", "--import", "tsx/esm", "server.ts"]
