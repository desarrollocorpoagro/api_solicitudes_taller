# 📖 Catálogo y Especificación de Endpoints — Backend Grupo San Luis

Documentación técnica y descriptiva de los endpoints disponibles en la API del **Grupo San Luis**. Desarrollado con **Node.js, Express, Sequelize ORM (MSSQL / SQLite)**, autenticación segura basada en tokens **JWT**, validaciones con **Joi**, registro de eventos con **Winston** y especificación estándar **OpenAPI / Swagger 3.0**.

---

## 📑 Tabla de Contenidos
1. [Autenticación Multi-Tenant](#1-autenticación-multi-tenant)
2. [Gestión de Usuarios y Roles (RBAC)](#2-gestión-de-usuarios-y-roles-rbac)
3. [Gestión de Empresas (Tenants)](#3-gestión-de-empresas-tenants)
4. [Maestro de Flota Vehicular y QR](#4-maestro-de-flota-vehicular-y-qr)
5. [Catálogo de Repuestos y Sincronización ERP](#5-catálogo-de-repuestos-y-sincronización-erp)
6. [Órdenes de Servicio (Taller San Luis)](#6-órdenes-de-servicio-taller-san-luis)
7. [Órdenes de Área (OT / Diagnóstico / Mano de Obra)](#7-órdenes-de-área-ot--diagnóstico--mano-de-obra)
8. [Solicitudes de Repuestos](#8-solicitudes-de-repuestos)
9. [Solicitudes de Servicios Externos y Garantías](#9-solicitudes-de-servicios-externos-y-garantías)
10. [Bandeja de Aprobaciones (Gerente de Taller y Flota)](#10-bandeja-de-aprobaciones-gerente-de-taller-y-flota)
11. [Despacho de Almacén y Movimientos ERP](#11-despacho-de-almacén-y-movimientos-erp)
12. [Notificaciones en Tiempo Real (Email y Push)](#12-notificaciones-en-tiempo-real-email-y-push)
13. [Almacenamiento Multimedia en la Nube](#13-almacenamiento-multimedia-en-la-nube)
14. [Motor Multiagente de Inteligencia Artificial](#14-motor-multiagente-de-inteligencia-artificial)
15. [Monitoreo y Diagnóstico del Sistema](#15-monitoreo-y-diagnóstico-del-sistema)

---

## 1. Autenticación Multi-Tenant

### `POST /api/v1/auth/login`
- **Descripción**: **Paso 1 de la autenticación**. Valida el correo electrónico y la contraseña del usuario contra la base de datos usando hash `bcrypt`. Si las credenciales son válidas, retorna la lista de empresas asignadas al usuario y emite un token temporal de pre-autenticación (`PRE_AUTH` con TTL de 15 minutos).
- **Control de Frecuencia**: Protegido por `authRateLimiter` (máximo 30 intentos cada 15 min).
- **Cuerpo de la Solicitud (JSON)**:
  ```json
  {
    "email": "admin@empresasanluis.com",
    "password": "Password123!"
  }
  ```
- **Respuesta Exitosa (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Autenticación exitosa. Seleccione una empresa para continuar.",
    "preAuthToken": "eyJhbGciOi...",
    "user": {
      "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "fullName": "Administrador San Luis",
      "email": "admin@empresasanluis.com",
      "role": "ADMIN"
    },
    "companies": [
      {
        "id": "11111111-1111-1111-1111-111111111111",
        "name": "Transporte Andina C.A.",
        "taxId": "J-30219482-1",
        "role": "ADMIN"
      }
    ]
  }
  ```

---

### `POST /api/v1/auth/select-company`
- **Descripción**: **Paso 2 de la autenticación**. Recibe el `companyId` seleccionado y valida criptográficamente (prevención estricta de vulnerabilidades IDOR) que el usuario autenticado en el `preAuthToken` realmente pertenezca a dicha empresa y esté activo. Emite el **JWT Definitivo (`FULL_AUTH`)** con duración de 8 horas conteniendo `userId`, `companyId`, `role` y matriz de `permissions`.
- **Cabeceras Requeridas**: `Authorization: Bearer <preAuthToken>`
- **Cuerpo de la Solicitud (JSON)**:
  ```json
  {
    "companyId": "11111111-1111-1111-1111-111111111111"
  }
  ```
- **Respuesta Exitosa (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Acceso a empresa concedido.",
    "token": "eyJhbGciOi...",
    "activeCompany": {
      "id": "11111111-1111-1111-1111-111111111111",
      "name": "Transporte Andina C.A.",
      "taxId": "J-30219482-1",
      "role": "ADMIN",
      "permissions": [...]
    }
  }
  ```

---

### `GET /api/v1/auth/me`
- **Descripción**: Devuelve los datos del perfil del usuario en sesión, su empresa activa y las capacidades otorgadas en el token JWT.
- **Cabeceras Requeridas**: `Authorization: Bearer <token>`

---

## 2. Gestión de Usuarios y Roles (RBAC)

### `GET /api/v1/users`
- **Descripción**: Lista todos los usuarios registrados en el sistema, junto con sus roles globales y empresas asociadas. Requiere rol `ADMIN` o `GERENTE_TALLER`.

### `POST /api/v1/users`
- **Descripción**: Registra un nuevo usuario en la base de datos con contraseña encriptada por `bcrypt` y validación de esquema con `Joi`.
- **Cuerpo de la Solicitud (JSON)**:
  ```json
  {
    "fullName": "Carlos Ojeda",
    "email": "carlos.ojeda@empresasanluis.com",
    "password": "Password123!",
    "phone": "+58 414 7778899",
    "role": "MECANICO",
    "isActive": true
  }
  ```

### `PUT /api/v1/users/:id`
- **Descripción**: Modifica nombre, rol, estado activo o contraseña de un usuario existente.

### `DELETE /api/v1/users/:id`
- **Descripción**: Elimina a un usuario y revoca todas sus asignaciones a empresas.

### `POST /api/v1/users/:id/assign-company`
- **Descripción**: Asigna un usuario a una empresa tenant con un rol específico y permisos granulares por módulo (`taller`, `fleet`, `inventory`, `reports`, `users`).

---

## 3. Gestión de Empresas (Tenants)

### `GET /api/v1/companies`
- **Descripción**: Lista las unidades de negocio/empresas del Grupo San Luis (ej. Transporte Andina, Agro Llanos, Distribuidora Centro).

### `POST /api/v1/companies`
- **Descripción**: Registra una nueva empresa en el sistema multi-tenant con su respectivo RIF / NIT.

---

## 4. Maestro de Flota Vehicular y QR

### `GET /api/v1/flota`
- **Descripción**: Obtiene el inventario completo de unidades de transporte y maquinaria de la empresa activa.

### `GET /api/v1/flota/:placa`
- **Descripción**: Consulta una unidad por su placa alfanumérica. Retorna marca, año, tipo, empresa propietaria, centro de costo, kilometraje acumulado y **detección automática de reincidencias** (si la unidad ingresó a taller en los últimos 30 días, indica la orden anterior y el área de servicio).

### `POST /api/v1/flota/scan-qr`
- **Descripción**: Procesa la lectura del código QR adherido al vehículo, reconociendo la unidad y precargando automáticamente la ficha técnica en la orden de servicio.

---

## 5. Catálogo de Repuestos y Sincronización ERP

### `GET /api/v1/catalogo`
- **Descripción**: Devuelve el catálogo maestro de repuestos (códigos, descripción, stock disponible en almacén `TLL-01`, costo unitario y categoría). Incluye timestamp de sincronización con el ERP Profit Plus.

### `PUT /api/v1/catalogo/:cod/stock`
- **Descripción**: Actualiza existencias o costos de un repuesto específico tras una entrada de almacén o conciliación contable.

---

## 6. Órdenes de Servicio (Taller San Luis)

### `POST /api/v1/ordenes`
- **Descripción**: **Apertura de una nueva Orden de Servicio**. Genera el identificador único correlativo (`OS-YYYY-XXXXX`), registra la placa, kilometraje, receptor, operador que entrega, síntomas reportados y advertencia de reincidencia. Dispara notificación por correo electrónico.
- **Cuerpo de la Solicitud (JSON)**:
  ```json
  {
    "placa": "A12BC3D",
    "km": 184320,
    "recibidoPor": "Ing. Carlos Mendoza",
    "entregadoPor": "Luis Márquez",
    "sintomas": "Ruido metálico al frenar y vibración en el volante sobre 60 km/h.",
    "esReincidencia": true,
    "osAnterior": "OS-2026-00089",
    "motivoReincidencia": "Falla distinta, misma área"
  }
  ```

### `GET /api/v1/ordenes`
- **Descripción**: Lista las órdenes de servicio con soporte para filtrado por estado (`Abierta`, `En Proceso`, `Cerrada`) y por placa.

### `GET /api/v1/ordenes/:id`
- **Descripción**: Obtiene la ficha consolidada de la orden de servicio, incluyendo:
  - Órdenes de área asociadas
  - Solicitudes de repuestos y estado de entrega
  - Servicios externos y garantías
  - **Liquidación financiera en tiempo real** (Costo de repuestos, mano de obra, servicios externos, costo evitado por garantía y total imputado al centro de costo)
  - **Matriz de validaciones de cierre** (indica con precisión los puntos bloqueantes si la orden aún no puede cerrarse).

### `POST /api/v1/ordenes/:id/cerrar`
- **Descripción**: **Cierre definitivo de la Orden de Servicio**. Evalúa las reglas de negocio de cierre:
  - Unidad y síntomas registrados
  - Al menos una orden de área creada
  - Cero órdenes de área en estado abierta
  - Cero solicitudes de repuestos o externos pendientes de aprobación
  - Cero repuestos aprobados pendientes de despacho físico
  - Horas de mano de obra reportadas (> 0)
  - Motivo de reincidencia especificado si aplica.
  Al cerrar, fija la fecha de entrega, registra a quien recibe conforme y emite la liquidación para conciliación ERP.

---

## 7. Órdenes de Área (OT / Diagnóstico / Mano de Obra)

### `POST /api/v1/ordenes/:id/areas`
- **Descripción**: Abre una orden de área técnica (`OT-A1`, `OT-A2`...) asignando mecánico, fecha de recepción, área especializada y triaje diagnóstico.
- **Áreas Soportadas y Tarifas**:
  - `Mtto preventivo` ($12/h)
  - `Reparaciones mayores` ($18/h)
  - `Mtto correctivo` ($15/h)
  - `Metalmecánica` ($20/h)
  - `Latonería y pintura` ($16/h)
  - `Cauchera` ($10/h)
  - `Lavado` ($7/h)

### `PUT /api/v1/ordenes/:id/areas/:otId`
- **Descripción**: Actualiza el diagnóstico técnico, reporta horas de mano de obra trabajadas o cierra/reabre la orden de área tras validar que no existan solicitudes pendientes.

### `DELETE /api/v1/ordenes/:id/areas/:otId`
- **Descripción**: Anula una orden de área siempre que no contenga solicitudes de repuestos o servicios externos asociadas.

---

## 8. Solicitudes de Repuestos

### `POST /api/v1/ordenes/:id/repuestos`
- **Descripción**: Registra una solicitud de repuesto vinculada a una orden de área. Valida existencia contra el catálogo de almacén y calcula el costo total. Si el monto total supera **$500.00**, marca automáticamente la solicitud con bandera de escalamiento para aprobación de flota.

### `DELETE /api/v1/ordenes/:id/repuestos/:repId`
- **Descripción**: Anula una solicitud de repuesto no despachada.

---

## 9. Solicitudes de Servicios Externos y Garantías

### `POST /api/v1/ordenes/:id/externos`
- **Descripción**: Agrega una solicitud de trabajo en taller externo (rectificado, soldadura especial, etc.). Permite marcar **cobertura por garantía**, en cuyo caso el costo imputado es **$0.00** y se asocia la orden de origen.

### `DELETE /api/v1/ordenes/:id/externos/:extId`
- **Descripción**: Anula una solicitud de servicio externo.

---

## 10. Bandeja de Aprobaciones (Gerente de Taller y Flota)

### `GET /api/v1/aprobaciones`
- **Descripción**: Bandeja consolidada de solicitudes de repuestos y servicios externos para toma de decisiones del Gerente de Taller. Marca explícitamente ítems con existencia insuficiente o montos superiores a $500.00.

### `POST /api/v1/aprobaciones/:tipo/:id`
- **Descripción**: Aprueba o rechaza una solicitud (`tipo`: `repuesto` | `externo`).
  - Si se aprueba un repuesto con stock suficiente: Pasa a `Por entregar`.
  - Si se aprueba un repuesto con stock insuficiente: Pasa a `Backorder` y genera automáticamente una **requisición de compra en el ERP Profit Plus**.

---

## 11. Despacho de Almacén y Movimientos ERP

### `GET /api/v1/almacen/despachos`
- **Descripción**: Lista todos los repuestos aprobados que se encuentran pendientes de entrega física en el mostrador del almacén `TLL-01`.

### `POST /api/v1/almacen/despachos/:id`
- **Descripción**: Confirma la entrega del repuesto al mecánico, descuenta las existencias del inventario y genera el correlativo de movimiento de ajuste de inventario (`AJS-XXXX`) en el ERP.

---

## 12. Notificaciones en Tiempo Real (Email y Push)

### `GET /api/v1/notificaciones`
- **Descripción**: Consulta el histórico de alertas, correos electrónicos y notificaciones push emitidas.

### `POST /api/v1/notificaciones/send`
- **Descripción**: Permite emitir una notificación manual transaccional por Email o Web Push.

### `POST /api/v1/notificaciones/subscribe-push`
- **Descripción**: Registra una suscripción Web Push desde el navegador o dispositivo móvil para interacción push en tiempo real.

---

## 13. Almacenamiento Multimedia en la Nube

### `POST /api/v1/multimedia/upload`
- **Descripción**: Carga fotografías de fallas mecánicas, evidencias de inspección técnica o comprobantes de garantía. Compatible con almacenamiento local y buckets Cloud S3 / GCS.
- **Tipo de Contenido**: `multipart/form-data` con campo de archivo `archivo` y campos adicionales `ordenId` y `tipo`.

### `GET /api/v1/multimedia/orden/:ordenId`
- **Descripción**: Lista todas las fotografías y documentos vinculados a una orden de servicio.

---

## 14. Motor Multiagente de Inteligencia Artificial

### `POST /api/v1/ai/query`
- **Descripción**: Consulta al motor multiagente del Grupo San Luis (integrado con **Gemini API** y motor experto de respaldo).
- **Agentes Disponibles**:
  - `orchestrator`: Analiza la consulta y enruta al especialista correspondiente.
  - `fleet`: Especialista en diagnóstico vehicular, fallas mecánicas, reincidencias y tiempos estándar de taller.
  - `agronomy`: Especialista en maquinaria de campo, tractores, cosechadoras y ciclos productivos.

---

## 15. Monitoreo y Diagnóstico del Sistema

### `GET /health`
- **Descripción**: Healthcheck de disponibilidad del servicio, entorno y dialecto de base de datos en uso.

### `POST /api/v1/system/run-tests`
- **Descripción**: Ejecuta bajo demanda la suite completa de pruebas unitarias y de integración del backend, retornando resultados y tiempos de respuesta.

### `GET /api-docs`
- **Descripción**: Interfaz interactiva de Swagger UI para probar todos los endpoints desde el navegador.

### `GET /api-docs-json`
- **Descripción**: Especificación OpenAPI 3.0.3 en formato JSON plano.

---

## 16. Conexión Adicional MSSQL Profit Plus (`AD_TRANS`)

Conexión dedicada a la base de datos **`AD_TRANS`** en el servidor MSSQL **`SRVBDPROFITBK`** (usuario `fvelazco`, pass `123`) para operaciones directas en la tabla **`dbo.flota_ordenes_servicio`**.

### `GET /api/v1/profit/conexion/status`
- **Descripción**: Diagnostica y reporta el estado de conectividad con el servidor `SRVBDPROFITBK` y la base de datos `AD_TRANS`, incluyendo tiempo de respuesta (latencia en ms) y dialecto activo.

### `GET /api/v1/profit/flota-ordenes/stats`
- **Descripción**: Obtiene métricas agregadas en tiempo real de `AD_TRANS`: conteo de órdenes abiertas, en proceso, cerradas, reincidencias y sumatoria de costos (repuestos, mano de obra, externos, total).

### `GET /api/v1/profit/flota-ordenes`
- **Descripción**: Lista paginada de órdenes de servicio registradas en `dbo.flota_ordenes_servicio`.
- **Query Params**: `page`, `limit`, `placa`, `estatus`, `search`, `es_reincidencia`, `fecha_desde`, `fecha_hasta`, `sortBy`, `sortOrder`.

### `GET /api/v1/profit/flota-ordenes/:id`
- **Descripción**: Obtiene el detalle completo de una orden de servicio por su `id_orden` (numérico) o por su `nro_orden`.

### `POST /api/v1/profit/flota-ordenes`
- **Descripción**: Registra una nueva orden en `dbo.flota_ordenes_servicio`. Valida unicidad de `nro_orden` y calcula automáticamente `costo_total`.
- **Cuerpo de la Solicitud (JSON)**:
  ```json
  {
    "nro_orden": "OS-2026-00095",
    "Placa": "A89BC1D",
    "km_horometro": 145200.50,
    "recibido_por": "Ing. Carlos Mendoza",
    "entregado_por": "Luis Márquez (Operador)",
    "fec_apertura": "2026-08-27T08:00:00Z",
    "sintomas_reportados": "Revisión general del sistema de frenos y cambio de lubricantes",
    "es_reincidencia": false,
    "nro_orden_anterior": null,
    "motivo_reincidencia": null,
    "fotos_adjuntas": 2,
    "estatus": "ABIERTA",
    "costo_repuestos": 150.00,
    "costo_mano_obra": 50.00,
    "costo_servicios_ext": 25.00,
    "recibe_conforme": null
  }
  ```

### `PUT /api/v1/profit/flota-ordenes/:id`
- **Descripción**: Actualiza campos de la orden en `dbo.flota_ordenes_servicio`. Si el estatus cambia a `CERRADA`, asigna automáticamente `fec_cierre` y `hora_cierre`.

### `DELETE /api/v1/profit/flota-ordenes/:id`
- **Descripción**: Elimina una orden de servicio de `dbo.flota_ordenes_servicio` por `id_orden` o `nro_orden`.

