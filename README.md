# 🚜 Plataforma Backend Grupo San Luis — Multi-Tenant & Taller API

Sistema Backend empresarial y módulo de gestión operativa desarrollado con **Node.js, Express y TypeScript** bajo arquitectura limpia y modular. Integra persistencia relacional con **Sequelize ORM** para servidores **Microsoft SQL Server (MSSQL)** con fallback automático a SQLite, autenticación segura basada en tokens **JWT en dos pasos**, validaciones con esquemas **Joi**, documentación interactiva **Swagger (OpenAPI 3.0.3)** en español, sistema de logs con **Winston**, motor multiagente de **IA (Gemini)**, notificaciones transaccionales (Email & Push), carga de archivos multimedia y contenedorización completa con **Docker & CI/CD**.

---

## 🏛️ Arquitectura del Sistema

```
/
├── server.ts                  # Servidor principal Express + Vite Middleware + Swagger + Healthcheck
├── Dockerfile                 # Contenedorización multi-stage optimizada
├── docker-compose.yml         # Orquestación con backend Node.js + Microsoft SQL Server 2022
├── ENDPOINTS.md               # Especificación técnica detallada de cada endpoint
├── .github/workflows/ci-cd.yml# Pipeline de Integración y Entrega Continua (CI/CD)
├── src/
│   ├── backend/               # Módulo de Backend Modular
│   │   ├── config/            # Conexión Sequelize (MSSQL/SQLite) y Swagger UI
│   │   ├── models/            # Modelos relacionales de Sequelize y Seeder
│   │   ├── middlewares/       # JWT Auth, Aislamiento de Tenant, Joi, RateLimit, Upload
│   │   ├── validations/       # Esquemas de validación Joi
│   │   ├── controllers/       # Controladores de negocio
│   │   ├── routes/            # Enrutamiento modular por dominio
│   │   ├── services/          # Email, WebPush, Cloud Storage, Sincronización ERP Profit
│   │   ├── agents/            # Motor Multiagente (Orquestador, Flota, Agronomía)
│   │   ├── utils/             # Logger Winston y formatos de consola
│   │   └── tests/             # Suite completa de pruebas unitarias
│   └── (Frontend React UI)    # Panel interactivo de Taller, Usuarios, Swagger Explorer y Logs
```

---

## ⚡ Requisitos y Puesta en Marcha

### 1. Variables de Entorno
Copie el archivo de ejemplo `.env.example` y configure sus credenciales:
```bash
cp .env.example .env
```

Variables clave configuradas:
- `PORT=3000`
- `DB_DIALECT=mssql` (o `sqlite` para pruebas locales)
- `DB_HOST=localhost`
- `DB_PORT=1433`
- `DB_NAME=sanluis_db`
- `DB_USER=sa`
- `DB_PASSWORD=Password123!`
- `JWT_SECRET=development-secret-keys-for-sanluis-app-2026`
- `JWT_PREAUTH_SECRET=development-preauth-secret-keys-for-sanluis-app-2026`
- `STORAGE_DRIVER=local` (o `s3` para almacenamiento en la nube)

### 2. Instalación de Dependencias
```bash
npm install
```

### 3. Ejecución en Modo Desarrollo
```bash
npm run dev
```
El servidor arrancará en **http://localhost:3000** con recarga en vivo (`tsx`).

---

## 🐳 Despliegue con Docker y Docker Compose

Para desplegar la pila completa (Servidor Backend + Base de Datos MSSQL 2022):

```bash
# Levantar los contenedores en segundo plano
docker-compose up -d --build

# Verificar el estado de los servicios y healthcheck de MSSQL
docker-compose ps

# Ver logs de la API en tiempo real
docker-compose logs -f api
```

---

## 🧪 Pruebas Unitarias

El proyecto cuenta con una suite automatizada de pruebas para los servicios de seguridad, criptografía, flujo de taller, reglas de cierre, liquidación, ERP y notificaciones:

```bash
npm test
```

También es posible ejecutar las pruebas en tiempo real mediante el endpoint:
`POST /api/v1/system/run-tests` o a través del panel de control web.

---

## 📚 Documentación Interactiva de la API (Swagger UI)

Una vez iniciado el servidor, acceda a la documentación visual interactiva:
- **Swagger UI:** `http://localhost:3000/api-docs`
- **JSON OpenAPI 3.0:** `http://localhost:3000/api-docs-json`
- **Catálogo Markdown:** Consulte el archivo [`ENDPOINTS.md`](./ENDPOINTS.md).

---

## 🔐 Seguridad Implementada
1. **Flujo de Autenticación en 2 Pasos**: Pre-autenticación (`PRE_AUTH`) para listar empresas autorizadas y emisión de token final (`FULL_AUTH`) con matriz de permisos RBAC.
2. **Aislamiento Estricto de Tenants**: El contexto de empresa se extrae de forma prioritaria del JWT criptográfico para evitar vulnerabilidades de tipo IDOR.
3. **Validaciones con Joi**: Todos los endpoints validan entradas en `body`, `params` y `query`.
4. **Protección contra Fuerza Bruta**: Rate limiting con `express-rate-limit` en rutas de autenticación.
5. **Cabeceras de Seguridad**: `helmet` y `cors` configurados para mitigar ataques XSS y Clickjacking.
6. **Logs con Winston**: Registro estructurado de eventos con niveles `info`, `warn`, `error` y stream HTTP con `morgan`.

---

## 🛠️ Credenciales de Demostración Iniciales
- **Administrador:** `admin@empresasanluis.com` / `Password123!`
- **Gerente de Taller:** `gerente.taller@empresasanluis.com` / `Password123!`
- **Responsable de Flota:** `flota@empresasanluis.com` / `Password123!`
- **Almacén:** `almacen@empresasanluis.com` / `Password123!`
- **Mecánico:** `jose.ramirez@empresasanluis.com` / `Password123!`
