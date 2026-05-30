FROM node:22-bookworm-slim AS build
# OpenSSL lets Prisma pick the correct query-engine binary without guessing.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY prisma/ prisma/
COPY src/ src/
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim AS final
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production PORT=8080

# Production dependencies plus the generated Prisma client and the Prisma CLI
# (needed by the entrypoint to run `migrate deploy`).
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm install prisma@6.5.0
COPY prisma/ prisma/
RUN npx prisma generate
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 8080
# busybox wget is not present in bookworm-slim, so the compose healthcheck uses node.
ENTRYPOINT ["./docker-entrypoint.sh"]
