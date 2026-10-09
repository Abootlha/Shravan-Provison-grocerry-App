# syntax=docker/dockerfile:1

# ---- build: install all deps and compile the NestJS app ----
FROM node:20-alpine AS build
WORKDIR /app

# Toolchain for native modules (bcrypt) in case no prebuilt binary matches musl.
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npx nest build

# Drop devDependencies so only runtime deps are copied forward.
RUN npm prune --omit=dev && npm cache clean --force

# ---- runtime: minimal image, non-root ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

# The official image ships an unprivileged "node" user (uid 1000).
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health || exit 1

CMD ["node", "dist/main"]
