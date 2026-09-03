# =======================================================
# DOCKERFILE - GRUPO SAN LUIS BACKEND & FULLSTACK API
# =======================================================

# Etapa 1: Construcción (Build Stage)
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias requeridas para compilación nativa si aplica
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .

# Construcción de la aplicación (Frontend Vite + Backend Bundled)
RUN npm run build

# Etapa 2: Imagen de Producción (Production Stage)
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Instalar dependencias de producción mínimas
COPY package*.json ./
RUN npm ci --only=production

# Copiar archivos compilados y configuraciones
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.env.example ./.env.example

# Crear directorios para base de datos local y almacenamiento multimedia
RUN mkdir -p /app/data/uploads && chown -R node:node /app

USER node

EXPOSE 4000

# Comando de inicio del servidor backend compilado
CMD ["node", "dist/server.cjs"]
