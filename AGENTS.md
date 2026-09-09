# AGENTS.md

Guía compacta para trabajar en `api_solicitudes_taller` (Plataforma Taller Grupo San Luis, Node/Express/TS + React/Vite). README.md y ENDPOINTS.md describen la arquitectura; aquí van solo los hechos que un agente probablemente erraría sin ayuda.

## Entorno de la máquina
- Windows + PowerShell 5.1. **No hay `bun` ni `rg`/`grep` en PATH** (usar `npm` o el Bun portable en `$env:TEMP\opencode\bun\bun-windows-x64\bun.exe`). Para buscar contenido usar la herramienta Grep.
- Node local v24 (obligatorio: el puente SQLite usa `node:sqlite`, no existe en Node 20). Bun solo se usa para CI/Docker.
- En PowerShell, `node -e` con variables es frágil: para queries puntuales a las BDs escribir un `.cjs` temporal en `$env:TEMP\opencode\` y ejecutarlo.

## Gestor de paquetes
- Fuente de verdad: **`bun.lock`**. CI y Docker corren `bun install --frozen-lockfile`.
- `package-lock.json` es **legacy/stale**: NO confiar en `npm install` (drift). Sin bun en PATH, instalar con el Bun portable; `bun add/remove` actualiza `bun.lock`.
- Añadir saltos en `package.json` → `allowScripts` para paquetes con postinstall (esbuild, sqlite3, protobufjs).

## Comandos
- Dev: `npm run dev` (backend 4000 + Vite 4100 con proxy `/api`; `predev` corre `scripts/ensure-ports.cjs`).
- Lint: `npm run lint` = `tsc --noEmit` (no hay ESLint).
- Tests: `npm test` = `tsx src/backend/tests/runTests.ts` (suite autocontenida, 18 tests).
- Build: `npm run build` = `vite build` + `esbuild server.ts` → `dist/server.cjs` + Vite assets.
- Prod: `npm run start` = `node dist/server.cjs`. Health: `GET /api/health`.

## Dual-DB (MSSQL ↔ SQLite) — punto de errores frecuente
- BD local Sequelize: `data/sanluis.sqlite` (aplicación, catálogos, órdenes, gastos).
- Profit MSSQL `AD_TRANS` con **fallback automático a espejo SQLite** `data/profit_ad_trans.sqlite` (configurado en `src/backend/config/profitDb.ts`). Ambos `.sqlite*` están **versionados en git**; tests y sync los mutan → expectativa de `git status` sucio.
- Patrón de selección de fuente: `profitSequelize.getDialect() === 'mssql' ? '[AD_TRANS].[dbo].[...]' : '...'` (ver `resolveFlotaOrdenId` en `gastos.service.ts`).
- La UI alimenta catálogo/sync desde la **vista espejo** `vw_flota_articulos` (≈910 filas), no desde `CatalogoRepuesto` (≈80 filas, subset sincronizado). Códigos válidos solo en el espejo devuelven **404 en repuestos**; resolverlos con `RepuestosController.resolveArticuloDesdeMirror` (auto-registro en `CatalogoRepuesto`), ya aplicado en `repuestos.controller.ts`.
- Códigos con padding: usar `whereTrimCod` (`src/backend/utils/trimWhere.ts`) para buscar por `TRIM(cod)`.
- **Trigger MSSQL en `dbo.gastos`**: `trg_gastos_AfterInsert_InsertarPlacom` (AFTER INSERT) ejecuta `InsertarPlacomCompletoDesdeSolicitudOrden @gasto_id=id_ordenser` por cada fila con `id_ordenser` no nulo. Si ese SP falla (p.ej. PK duplicado en `placom.fact_num` o `RAISERROR`), **aborta el INSERT del gasto** y Sequelize a menudo reporta `message=''` (vacío) — no es error de red. Workaround aplicado en `upsertGastoToMssql`: si el MERGE falla, reintenta 1 vez con `id_ordenser=NULL` (el trigger filtra `IS NOT NULL`); el gasto se sincroniza pero pierde la cascada a placom/ajuste.

## Convenciones backend
- Controladores = clases con métodos `static` (patrón en `src/backend/controllers/*`). Rutas por dominio en `routes/*`. Validación Joi en `validations/schemas.ts`.
- Sync de `vw_flota_articulos` → `CatalogoRepuesto`: ver mapping en `sync.service.ts` (aprox. línea 412) — es el patrón de mapeo de columnas.
- Gastos: hooks `afterCreate/afterUpdate` en modelos (`gastos.service.ts`, `ensureLocalGasto*`) → columna `placa` incluida; estado machine `PENDIENTE/ENVIADO/ERROR` + sync cada 60s.

## Frontend (React 19 + Vite + Tailwind 4)
- Iconos `lucide-react`; no usar librerías extra sin verificar `package.json`.
- Selector de órdenes: componente compartido **`src/components/OrdenPicker.tsx`** (autocompletado por placa/nº orden). Usado en `TallerModule` (label "Órdenes de {Empresa}") y `MultimediaModule`. Reutilizarlo, no duplicar `<select>`.
- OCR de placa (móvil): Tesseract.js **self-hosted** en `public/tess/` (worker + cores WASM ≈43MB) y modelo `public/tessdata/eng.traineddata.gz`. Flujo en `OrdenPicker.runOcr`: `createWorker(..., OEM.LSTM_ONLY)` + `setParameters({tessedit_char_whitelist, tessedit_pageseg_mode})` + fuzzy match (levenshtein) contra placas/nº de orden. Botón cámara solo con `matchMedia('(pointer: coarse)')`. No romper el lazy `await import('tesseract.js')` ni las rutas `/tess/` `/tessdata/`.
- `public/*` se sirve en dev y se copia a `dist/`; NO usar `vite-plugin-static-copy` para estos binarios.

## Agentes IA (motor multiagente)
- Orquestador: `src/backend/agents/orchestrator.agent.ts` — `MultiAgentOrchestrator.processRequest(prompt, agentType?, context?)` → enruta a `FleetAgent` (default/taller/flota) o `AgronomyAgent` (agronomía, también por keywords cosecha/siembra/campo/suelo/agrícola). Retorna `{ agent, response }`.
- Especialistas en `agents/specialists/*`: híbridos — si `GEMINI_API_KEY` env está definido usan `GoogleGenAI` (`gemini-2.5-flash`); si no hay key o falla, **fallback a motor experto local** (reglas en español).
- Endpoint: `POST /api/v1/ai/query` (`{prompt, agentType?, context?}`) — no tiene visión/OCR; no asumir capacidades de imagen.

## Testing
- Env para tests: `NODE_ENV=test`, `DB_DIALECT=sqlite`, `PROFIT_DB_DIALECT=sqlite`, `JWT_SECRET=...` (CI usa `PROFIT_DB_DIALECT: sqlite`).
- La suite inserta fixtures idempotentes (`FRE-0234` en catálogo, `TEST-2601` en espejo, placa demo) → muta `data/*.sqlite*`; revertir solo si se pide.
- Validación final para cualquier cambio: `npm run lint` → `npm test` → `npm run build`.

## Git
- Estilo de mensajes: prefijo `feat:` / `fix:` / `ci:` / `chore:` en minúscula + español imperativo corto.
- Convención del repo: los cambios de `data/*.sqlite*` se incluyen en commits ("actualizar artefactos de desarrollo"). Binarios pesados nuevos (p.ej. `public/tess/*`) se versionan igual.
- No commitear secretos: `.env` está gitignoreado, pero `scripts/*.json` contienen credenciales de prueba — no crear nuevos.
- `dist/` y `node_modules/` están en `.gitignore`.