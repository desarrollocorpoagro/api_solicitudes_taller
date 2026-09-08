# =======================================================
# DOCKERFILE - GRUPO SAN LUIS BACKEND & FULLSTACK API
# =======================================================

# Etapa 1: Construcción (Build Stage)
# Se usa Bun porque el proyecto gestiona dependencias con bun.lock
# (no existe package-lock.json, por lo que `npm ci` no funciona).
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Instalar dependencias requeridas para compilación nativa si aplica
RUN apk add --no-cache python3 make g++

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Construcción de la aplicación (Frontend Vite + Backend Bundled)
RUN bun run build

# Etapa 2: Imagen de Producción (Production Stage)
# Node 24: el puente SQLite local (sqliteBridge.cjs) usa node:sqlite,
# estable únicamente en Node >= 24. En Node 20 no existe ese módulo.
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Copiar node_modules compilados por Bun (misma libc musl en Alpine) y artefactos
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.env.example ./.env.example

# Crear directorios para base de datos local y almacenamiento multimedia
RUN mkdir -p /app/data/uploads && chown -R node:node /app

USER node

EXPOSE 4000

# Comando de inicio del servidor backend compilado
CMD ["node", "dist/server.cjs"]