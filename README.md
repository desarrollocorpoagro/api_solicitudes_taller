# 🚜 Plataforma Backend Grupo San Luis — Multi-Tenant & Taller API

Sistema backend para gestión operativa de taller, flota, almacén y sincronización con ERP Profit. La solución usa Node.js, Express, TypeScript y Sequelize con soporte nativo para Microsoft SQL Server y fallback automático a SQLite para entorno local.

Esta versión ya incorpora la sincronización maestra bidireccional entre la base local y la base de Profit AD_TRANS, con espejo SQLite local para mantener continuidad cuando el servidor remoto no está disponible.

---

## ✅ Estado actual del proyecto

- Conexión real a MSSQL del servidor Profit habilitada cuando la red y credenciales están disponibles.
- Fallback local a SQLite si la conexión remota falla.
- Espejo SQLite persistente en data/profit_ad_trans.sqlite.
- Sincronización maestra de entidades: mecánicos, vendedores, artículos y órdenes de servicio de flota.
- Arranque estable con manejo de puerto en caso de conflicto.
- HMR/Vite configurado en un puerto fijo libre para evitar colisiones de WebSocket.
- Protección anti-duplicados para evitar fallos de integridad en SQLite.

---

## 🏗️ Arquitectura principal

```
/
├── server.ts                    # Bootstrap del backend, Swagger, Vite en dev y arranque
├── vite.config.ts              # Configuración del front y HMR
├── Dockerfile                  # Imagen del backend
├── docker-compose.yml          # Orquestación local
├── README.md                   # Documentación principal
├── ENDPOINTS.md                # Catalogo de endpoints
├── data/
│   ├── uploads/                # Archivos multimedia
│   └── profit_ad_trans.sqlite  # Espejo local de datos Profit
├── src/
│   ├── backend/
│   │   ├── config/             # MSSQL/SQLite, swagger, DB principal y Profit
│   │   ├── controllers/        # API handlers
│   │   ├── models/             # Modelos Sequelize y semilla
│   │   ├── routes/             # Endpoints por módulo
│   │   ├── services/           # Sync y sincronización maestra
│   │   ├── middlewares/        # JWT, validación, tenant y upload
│   │   ├── validations/        # Joi schemas
│   │   ├── tests/              # Suite de pruebas
│   │   └── utils/              # Logger y utilidades
│   └── App.tsx                 # Frontend React
```

---

## ⚙️ Requisitos

- Node.js 20+
- npm
- Acceso a Microsoft SQL Server del entorno Profit cuando se desea usar el modo real
- SQLite disponible para modo local/fallback

---

## ▶️ Puesta en marcha

### 1. Instalar dependencias

```bash
npm install
```

### 2. Iniciar en modo desarrollo

```bash
npm run dev
```

El backend arranca normalmente con el puerto base 3000 y, si ese puerto está ocupado, prueba el siguiente disponible. El HMR del frontend queda configurado en un puerto libre permanente para evitar conflictos de WebSocket.

### 3. Verificar salud del backend

```bash
curl http://localhost:3000/health
```

### 4. Verificar sincronización maestra

```bash
curl -X POST http://localhost:3000/api/v1/profit/sync/master
curl http://localhost:3000/api/v1/profit/sync/master/status
curl http://localhost:3000/api/v1/profit/sync/master/last-report
```

---

## 🔄 Sincronización maestra

El motor de sincronización maestra actual compara y mantiene consistencia entre:

- Local SQLite / base principal de la app
- MSSQL de Profit AD_TRANS

Entidades sincronizadas:

- mecánicos
- vendedores
- artículos
- flota_ordenes_servicio

La lógica ejecuta un ciclo inicial y luego continúa periódicamente para:

1. detectar faltantes en cada extremo,
2. comparar campos relevantes,
3. insertar registros nuevos,
4. actualizar diferencias,
5. evitar duplicados en SQLite antes del sync.

---

## 🧪 Pruebas

```bash
npm test
```

También se puede ejecutar por endpoint:

```http
POST /api/v1/system/run-tests
```

---

## 📚 Documentación interactiva

- Swagger UI: http://localhost:3000/api-docs
- JSON OpenAPI: http://localhost:3000/api-docs-json
- Endpoints: [ENDPOINTS.md](./ENDPOINTS.md)

---

## 🔐 Seguridad y calidad

- JWT con autenticación de dos pasos
- aislamiento por tenant y validación de permisos
- validación Joi en endpoints
- rate limiting
- CORS y Helmet
- logs con Winston
- semilla y replica local para desarrollo resiliente

---

## 🛠️ Credenciales de ejemplo

- Administrador: admin@empresasanluis.com / Password123!
- Gerente de taller: gerente.taller@empresasanluis.com / Password123!
- Flota: flota@empresasanluis.com / Password123!
- Almacén: almacen@empresasanluis.com / Password123!
- Mecánico: jose.ramirez@empresasanluis.com / Password123!

Nota: en entornos reales, reemplazar siempre por secretos y credenciales del cliente o infraestructura correspondiente.
