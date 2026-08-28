export const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Grupo San Luis — Backend API Multi-Tenant & Taller',
    version: '1.0.0',
    description: `### Plataforma Multi-Tenant PWA con Motor Multiagente y Gestión Integral de Taller
Documentación oficial de los endpoints de la API del Grupo San Luis desarrollada con Node.js, Express, Sequelize ORM (MSSQL / SQLite), validaciones Joi, autenticación JWT en dos pasos, control de acceso basado en roles (RBAC) y aislamiento estricto de tenants.

#### Flujo de Autenticación en 2 Pasos:
1. **POST /api/v1/auth/login**: Validación de credenciales y retorno de empresas asignadas + token temporal \`PRE_AUTH\`.
2. **POST /api/v1/auth/select-company**: Selección de la empresa activa y emisión del token definitivo \`FULL_AUTH\` (8 horas) con contexto de tenant y permisos.
`,
    contact: {
      name: 'Equipo de Desarrollo San Luis',
      email: 'desarrollo.corpoagro@gmail.com',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Servidor API v1 (Relativo)',
    },
    {
      url: 'http://localhost:3000/api/v1',
      description: 'Servidor Local de Desarrollo',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Ingrese su token JWT con formato: Bearer <token>',
      },
    },
    schemas: {
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'admin@empresasanluis.com' },
          password: { type: 'string', format: 'password', example: 'Password123!' },
        },
      },
      SelectCompanyRequest: {
        type: 'object',
        required: ['companyId'],
        properties: {
          companyId: { type: 'string', format: 'uuid', example: '11111111-1111-1111-1111-111111111111' },
        },
      },
      CreateUserRequest: {
        type: 'object',
        required: ['fullName', 'email', 'password'],
        properties: {
          fullName: { type: 'string', example: 'Pedro Morales' },
          email: { type: 'string', format: 'email', example: 'pedro.morales@empresasanluis.com' },
          password: { type: 'string', example: 'Password123!' },
          phone: { type: 'string', example: '+58 412 5556677' },
          role: { type: 'string', enum: ['ADMIN', 'GERENTE_TALLER', 'MECANICO', 'RESPONSABLE_FLOTA', 'ALMACENISTA', 'OPERADOR'], example: 'ALMACENISTA' },
          isActive: { type: 'boolean', example: true },
        },
      },
      CreateOrdenRequest: {
        type: 'object',
        required: ['placa', 'km', 'recibidoPor', 'sintomas'],
        properties: {
          placa: { type: 'string', example: 'A12BC3D' },
          km: { type: 'integer', example: 184320 },
          recibidoPor: { type: 'string', example: 'Ing. Carlos Mendoza' },
          entregadoPor: { type: 'string', example: 'Luis Márquez (Operador)' },
          sintomas: { type: 'string', example: 'Ruido metálico al frenar y vibración en el volante sobre 60 km/h.' },
          esReincidencia: { type: 'boolean', example: true },
          osAnterior: { type: 'string', example: 'OS-2026-00089' },
          motivoReincidencia: { type: 'string', example: 'Falla distinta, misma área' },
        },
      },
      CreateOrdenAreaRequest: {
        type: 'object',
        required: ['area', 'mecanico'],
        properties: {
          area: {
            type: 'string',
            enum: ['Mtto preventivo', 'Reparaciones mayores', 'Mtto correctivo', 'Metalmecánica', 'Latonería y pintura', 'Cauchera', 'Lavado'],
            example: 'Reparaciones mayores',
          },
          fechaRecepcion: { type: 'string', format: 'date-time', example: '2026-08-27T08:30:00.000Z' },
          mecanico: { type: 'string', example: 'José Ramírez' },
          diagnostico: { type: 'string', example: 'Desgaste severo en discos delanteros y holgura en terminales.' },
          horas: { type: 'number', example: 2.0 },
        },
      },
      CreateSolicitudRepuestoRequest: {
        type: 'object',
        required: ['otId', 'cod', 'cant'],
        properties: {
          otId: { type: 'string', example: 'OT-A1' },
          cod: { type: 'string', example: 'FRE-0234' },
          cant: { type: 'integer', example: 1 },
          motivo: { type: 'string', example: 'Reemplazo preventivo por alabeo excesivo.' },
        },
      },
      CreateSolicitudExternoRequest: {
        type: 'object',
        required: ['otId', 'proveedor', 'descripcion'],
        properties: {
          otId: { type: 'string', example: 'OT-A1' },
          proveedor: { type: 'string', example: 'Frenos y Rectificados Centro C.A.' },
          descripcion: { type: 'string', example: 'Rectificado de discos delanteros' },
          conGarantia: { type: 'boolean', example: false },
          ordenOrigenGarantia: { type: 'string', example: 'OS-2026-00089' },
          costoCotizado: { type: 'number', example: 45.00 },
        },
      },
      ProcesarAprobacionRequest: {
        type: 'object',
        required: ['accion'],
        properties: {
          accion: { type: 'string', enum: ['APROBAR', 'RECHAZAR'], example: 'APROBAR' },
          comentario: { type: 'string', example: 'Aprobado según disponibilidad presupuestaria.' },
        },
      },
      CerrarOrdenRequest: {
        type: 'object',
        required: ['recibeConforme'],
        properties: {
          fechaEntrega: { type: 'string', format: 'date-time', example: '2026-08-27T17:00:00.000Z' },
          recibeConforme: { type: 'string', example: 'Luis Márquez (Operador)' },
        },
      },
      AIQueryRequest: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: { type: 'string', example: 'Diagnosticar vibración al frenar a 60 km/h en camión Chevrolet NPR 2019 con 184.000 km.' },
          agentType: { type: 'string', enum: ['orchestrator', 'fleet', 'agronomy'], example: 'fleet' },
          context: { type: 'object' },
        },
      },
      ProfitFlotaOrdenRequest: {
        type: 'object',
        required: ['nro_orden', 'Placa', 'km_horometro', 'recibido_por', 'sintomas_reportados'],
        properties: {
          nro_orden: { type: 'string', example: 'OS-2026-00095' },
          Placa: { type: 'string', example: 'A89BC1D' },
          km_horometro: { type: 'number', example: 145200.5 },
          recibido_por: { type: 'string', example: 'Ing. Carlos Mendoza' },
          entregado_por: { type: 'string', example: 'Luis Márquez' },
          fec_apertura: { type: 'string', format: 'date-time', example: '2026-08-27T08:00:00.000Z' },
          sintomas_reportados: { type: 'string', example: 'Revisión general de sistema de frenos y cambio de aceite' },
          es_reincidencia: { type: 'boolean', example: false },
          nro_orden_anterior: { type: 'string', example: 'OS-2026-00080' },
          motivo_reincidencia: { type: 'string', example: 'Falla recurrente en bomba hidráulica' },
          fotos_adjuntas: { type: 'integer', example: 2 },
          estatus: { type: 'string', enum: ['ABIERTA', 'EN PROCESO', 'CERRADA', 'ANULADA', 'PENDIENTE_REPUESTOS'], example: 'ABIERTA' },
          costo_repuestos: { type: 'number', example: 150.0 },
          costo_mano_obra: { type: 'number', example: 50.0 },
          costo_servicios_ext: { type: 'number', example: 25.0 },
          costo_total: { type: 'number', example: 225.0 },
          recibe_conforme: { type: 'string', example: 'Luis Márquez' },
        },
      },
      ProfitFlotaOrdenUpdateRequest: {
        type: 'object',
        properties: {
          Placa: { type: 'string', example: 'A89BC1D' },
          km_horometro: { type: 'number', example: 145300.0 },
          estatus: { type: 'string', enum: ['ABIERTA', 'EN PROCESO', 'CERRADA', 'ANULADA', 'PENDIENTE_REPUESTOS'], example: 'CERRADA' },
          costo_repuestos: { type: 'number', example: 160.0 },
          costo_mano_obra: { type: 'number', example: 50.0 },
          costo_servicios_ext: { type: 'number', example: 25.0 },
          costo_total: { type: 'number', example: 235.0 },
          recibe_conforme: { type: 'string', example: 'Luis Márquez' },
          fec_cierre: { type: 'string', format: 'date-time', example: '2026-08-27T18:00:00.000Z' },
        },
      },
    },
  },
  paths: {
    '/auth/login': {
      post: {
        tags: ['Autenticación Multi-Tenant'],
        summary: 'Paso 1: Autenticación de credenciales de usuario',
        description: 'Verifica correo y contraseña, y retorna el token pre-auth junto con las empresas disponibles para el usuario.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          200: { description: 'Credenciales válidas, pre-token emitido' },
          401: { description: 'Credenciales inválidas' },
        },
      },
    },
    '/auth/select-company': {
      post: {
        tags: ['Autenticación Multi-Tenant'],
        summary: 'Paso 2: Selección de Tenant y emisión de Token Final de Sesión',
        description: 'Valida la pertenencia del usuario a la empresa seleccionada y emite el JWT definitivo con permisos y rol.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SelectCompanyRequest' } } },
        },
        responses: {
          200: { description: 'Acceso a empresa concedido, sesión iniciada' },
          403: { description: 'No autorizado para acceder a esta empresa' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Autenticación Multi-Tenant'],
        summary: 'Obtener información del usuario autenticado en la sesión activa',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Datos del usuario y empresa activa' },
        },
      },
    },
    '/users': {
      get: {
        tags: ['Gestión de Usuarios (RBAC)'],
        summary: 'Listar todos los usuarios registrados',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Lista de usuarios con empresas asignadas' },
        },
      },
      post: {
        tags: ['Gestión de Usuarios (RBAC)'],
        summary: 'Crear un nuevo usuario en el sistema',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateUserRequest' } } },
        },
        responses: {
          201: { description: 'Usuario creado exitosamente' },
        },
      },
    },
    '/users/{id}': {
      get: {
        tags: ['Gestión de Usuarios (RBAC)'],
        summary: 'Obtener detalle de un usuario por ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Detalle del usuario' },
        },
      },
      put: {
        tags: ['Gestión de Usuarios (RBAC)'],
        summary: 'Actualizar datos de un usuario',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Usuario actualizado' },
        },
      },
      delete: {
        tags: ['Gestión de Usuarios (RBAC)'],
        summary: 'Eliminar usuario del sistema',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Usuario eliminado' },
        },
      },
    },
    '/flota': {
      get: {
        tags: ['Maestro de Flota Vehicular'],
        summary: 'Listar todas las unidades de la flota',
        responses: {
          200: { description: 'Catálogo de flota vehicular' },
        },
      },
    },
    '/flota/{placa}': {
      get: {
        tags: ['Maestro de Flota Vehicular'],
        summary: 'Consultar unidad por placa con detección de reincidencias',
        parameters: [{ name: 'placa', in: 'path', required: true, schema: { type: 'string', example: 'A12BC3D' } }],
        responses: {
          200: { description: 'Datos de la unidad y estado de reincidencia' },
          404: { description: 'Placa no encontrada' },
        },
      },
    },
    '/flota/scan-qr': {
      post: {
        tags: ['Maestro de Flota Vehicular'],
        summary: 'Simular escaneo de código QR de unidad',
        responses: {
          200: { description: 'Unidad identificada vía QR' },
        },
      },
    },
    '/catalogo': {
      get: {
        tags: ['Catálogo de Repuestos & ERP'],
        summary: 'Listar catálogo de repuestos con existencias y costos',
        responses: {
          200: { description: 'Catálogo de repuestos sincronizado con ERP Profit Plus' },
        },
      },
    },
    '/ordenes': {
      post: {
        tags: ['Órdenes de Servicio (Taller)'],
        summary: 'Aperturar una nueva Orden de Servicio de Taller',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateOrdenRequest' } } },
        },
        responses: {
          201: { description: 'Orden de servicio creada exitosamente' },
        },
      },
      get: {
        tags: ['Órdenes de Servicio (Taller)'],
        summary: 'Listar órdenes de servicio con filtros',
        parameters: [
          { name: 'estado', in: 'query', schema: { type: 'string', enum: ['Abierta', 'En Proceso', 'Cerrada'] } },
          { name: 'placa', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Lista de órdenes' },
        },
      },
    },
    '/ordenes/{id}': {
      get: {
        tags: ['Órdenes de Servicio (Taller)'],
        summary: 'Obtener detalle completo de una orden con liquidación y validaciones de cierre',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', example: 'OS-2026-00101' } }],
        responses: {
          200: { description: 'Detalle de orden, liquidación y chequeo de validaciones' },
        },
      },
    },
    '/ordenes/{id}/cerrar': {
      post: {
        tags: ['Órdenes de Servicio (Taller)'],
        summary: 'Cerrar orden de servicio tras superar validaciones de negocio',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', example: 'OS-2026-00101' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CerrarOrdenRequest' } } },
        },
        responses: {
          200: { description: 'Orden cerrada y liquidada exitosamente' },
          400: { description: 'Validaciones de cierre no superadas' },
        },
      },
    },
    '/ordenes/{id}/areas': {
      post: {
        tags: ['Órdenes de Área (OT)'],
        summary: 'Abrir una nueva orden en un área de taller (OT)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateOrdenAreaRequest' } } },
        },
        responses: {
          201: { description: 'Orden de área creada' },
        },
      },
    },
    '/ordenes/{id}/areas/{otId}': {
      put: {
        tags: ['Órdenes de Área (OT)'],
        summary: 'Actualizar diagnóstico, horas o cerrar/reabrir orden de área',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'otId', in: 'path', required: true, schema: { type: 'string', example: 'OT-A1' } },
        ],
        responses: {
          200: { description: 'Orden de área actualizada' },
        },
      },
      delete: {
        tags: ['Órdenes de Área (OT)'],
        summary: 'Anular orden de área sin solicitudes asociadas',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'otId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Orden de área anulada' },
        },
      },
    },
    '/ordenes/{id}/repuestos': {
      post: {
        tags: ['Solicitudes de Repuesto'],
        summary: 'Solicitar repuesto del catálogo para una orden de área',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateSolicitudRepuestoRequest' } } },
        },
        responses: {
          201: { description: 'Solicitud de repuesto registrada' },
        },
      },
    },
    '/ordenes/{id}/repuestos/{repId}': {
      delete: {
        tags: ['Solicitudes de Repuesto'],
        summary: 'Anular solicitud de repuesto no despachada',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'repId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Solicitud de repuesto anulada' },
        },
      },
    },
    '/ordenes/{id}/externos': {
      post: {
        tags: ['Solicitudes de Servicio Externo'],
        summary: 'Solicitar servicio externo o trabajo por garantía',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateSolicitudExternoRequest' } } },
        },
        responses: {
          201: { description: 'Solicitud de servicio externo registrada' },
        },
      },
    },
    '/ordenes/{id}/externos/{extId}': {
      delete: {
        tags: ['Solicitudes de Servicio Externo'],
        summary: 'Anular solicitud de servicio externo',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'extId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Solicitud externa anulada' },
        },
      },
    },
    '/aprobaciones': {
      get: {
        tags: ['Bandeja de Aprobaciones (Gerencia & Flota)'],
        summary: 'Obtener bandeja de solicitudes para aprobación con umbral de $500',
        responses: {
          200: { description: 'Lista unificada de solicitudes de repuestos y servicios externos' },
        },
      },
    },
    '/aprobaciones/{tipo}/{id}': {
      post: {
        tags: ['Bandeja de Aprobaciones (Gerencia & Flota)'],
        summary: 'Aprobar o rechazar solicitud de repuesto o servicio externo',
        parameters: [
          { name: 'tipo', in: 'path', required: true, schema: { type: 'string', enum: ['repuesto', 'externo'] } },
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ProcesarAprobacionRequest' } } },
        },
        responses: {
          200: { description: 'Solicitud aprobada o rechazada' },
        },
      },
    },
    '/almacen/despachos': {
      get: {
        tags: ['Despacho de Almacén & Conciliación ERP'],
        summary: 'Listar repuestos aprobados pendientes de despacho físico',
        responses: {
          200: { description: 'Lista de repuestos aprobados' },
        },
      },
    },
    '/almacen/despachos/{id}': {
      post: {
        tags: ['Despacho de Almacén & Conciliación ERP'],
        summary: 'Confirmar despacho físico de repuesto y conciliación de inventario ERP',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Despacho confirmado y movimiento AJS generado en ERP' },
        },
      },
    },
    '/notificaciones': {
      get: {
        tags: ['Notificaciones (Email & Push)'],
        summary: 'Listar histórico de notificaciones y alertas',
        responses: {
          200: { description: 'Lista de notificaciones' },
        },
      },
    },
    '/notificaciones/send': {
      post: {
        tags: ['Notificaciones (Email & Push)'],
        summary: 'Emitir notificación manual por Email o Push',
        responses: {
          200: { description: 'Notificación emitida' },
        },
      },
    },
    '/multimedia/upload': {
      post: {
        tags: ['Multimedia & Documentos'],
        summary: 'Subir fotografía de síntomas o comprobante de garantía a la nube/almacenamiento',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  archivo: { type: 'string', format: 'binary' },
                  ordenId: { type: 'string' },
                  tipo: { type: 'string', enum: ['foto_sintoma', 'foto_diagnostico', 'comprobante_garantia'] },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Archivo subido y registrado exitosamente' },
        },
      },
    },
    '/ai/query': {
      post: {
        tags: ['Motor Multiagente de IA'],
        summary: 'Consultar motor multiagente (Orquestador, Flota, Agronomía)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AIQueryRequest' } } },
        },
        responses: {
          200: { description: 'Respuesta generada por el agente correspondiente' },
        },
      },
    },
    '/profit/conexion/status': {
      get: {
        tags: ['Profit Plus MSSQL (AD_TRANS)'],
        summary: 'Verificar estado de conexión MSSQL con servidor SRVBDPROFITBK (Base de datos AD_TRANS)',
        responses: {
          200: { description: 'Estado de conexión retornado' },
        },
      },
    },
    '/profit/vendedores': {
      get: {
        tags: ['Profit Plus MSSQL (AD_TRANS)'],
        summary: 'Listado con múltiples filtros y paginado de vendedores / responsables de flota desde vw_flota_vendedores',
        description: 'Ejecuta la consulta: SELECT [co_ven], [cedula], [ven_des] FROM [AD_TRANS].[dbo].[vw_flota_vendedores] con soporte de filtros por co_ven, cedula, ven_des, búsqueda global, ordenamiento y paginación.',
        parameters: [
          { name: 'page', in: 'query', description: 'Número de página (predeterminado 1)', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', description: 'Cantidad de registros por página (predeterminado 20, máx 100)', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', description: 'Búsqueda global por co_ven, cedula o ven_des', schema: { type: 'string' } },
          { name: 'co_ven', in: 'query', description: 'Filtrar por código de vendedor', schema: { type: 'string' } },
          { name: 'cedula', in: 'query', description: 'Filtrar por número de cédula de identidad', schema: { type: 'string' } },
          { name: 'ven_des', in: 'query', description: 'Filtrar por descripción / nombre del vendedor', schema: { type: 'string' } },
          { name: 'sortBy', in: 'query', description: 'Campo de ordenamiento', schema: { type: 'string', enum: ['co_ven', 'cedula', 'ven_des'], default: 'ven_des' } },
          { name: 'sortOrder', in: 'query', description: 'Sentido del orden', schema: { type: 'string', enum: ['ASC', 'DESC'], default: 'ASC' } },
        ],
        responses: {
          200: {
            description: 'Listado paginado de vendedores retornado exitosamente',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    source: { type: 'string', example: '[AD_TRANS].[dbo].[vw_flota_vendedores]' },
                    querySql: { type: 'string', example: 'SELECT [co_ven], [cedula], [ven_des] FROM [AD_TRANS].[dbo].[vw_flota_vendedores]' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          co_ven: { type: 'string', example: 'VEN-001' },
                          cedula: { type: 'string', example: 'V-14238910' },
                          ven_des: { type: 'string', example: 'Carlos Alberto Mendoza Rivas' },
                        },
                      },
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        total: { type: 'integer', example: 8 },
                        page: { type: 'integer', example: 1 },
                        limit: { type: 'integer', example: 20 },
                        totalPages: { type: 'integer', example: 1 },
                        hasMore: { type: 'boolean', example: false },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/profit/articulos': {
      get: {
        tags: ['Profit Plus MSSQL (AD_TRANS)'],
        summary: 'Listado con múltiples filtros y paginado de artículos y repuestos desde vw_flota_articulos',
        description: 'Ejecuta la consulta: SELECT [codigo_profit], [nombre_producto], [codigo_categoria], [categoria], [unidad_medida], [costo], [tipo], [codigo_subalmacen], [sub_almacen], [codigo_almacen], [almacen], [stock_act] FROM [AD_TRANS].[dbo].[vw_flota_articulos] con soporte completo de filtros por código, nombre, categoría, almacén, subalmacén, tipo, disponibilidad de stock, rangos de costo y stock, ordenamiento y paginación.',
        parameters: [
          { name: 'page', in: 'query', description: 'Número de página (predeterminado 1)', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', description: 'Cantidad de registros por página (predeterminado 20, máx 100)', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', description: 'Búsqueda global rápida en código, nombre, categoría y almacén', schema: { type: 'string' } },
          { name: 'codigo_profit', in: 'query', description: 'Filtrar por código de artículo Profit', schema: { type: 'string' } },
          { name: 'nombre_producto', in: 'query', description: 'Filtrar por nombre o descripción de producto', schema: { type: 'string' } },
          { name: 'codigo_categoria', in: 'query', description: 'Filtrar por código de categoría (ej. FIL, FRE, LUB)', schema: { type: 'string' } },
          { name: 'categoria', in: 'query', description: 'Filtrar por nombre de categoría', schema: { type: 'string' } },
          { name: 'codigo_almacen', in: 'query', description: 'Filtrar por código de almacén (ej. ALM-01, TLL-01)', schema: { type: 'string' } },
          { name: 'almacen', in: 'query', description: 'Filtrar por nombre de almacén', schema: { type: 'string' } },
          { name: 'codigo_subalmacen', in: 'query', description: 'Filtrar por código de sub-almacén', schema: { type: 'string' } },
          { name: 'sub_almacen', in: 'query', description: 'Filtrar por nombre de sub-almacén', schema: { type: 'string' } },
          { name: 'tipo', in: 'query', description: 'Filtrar por tipo (Repuesto, Consumible, Herramienta)', schema: { type: 'string' } },
          { name: 'con_stock', in: 'query', description: 'Filtrar por existencia en inventario (true = stock > 0, false = stock 0)', schema: { type: 'boolean' } },
          { name: 'min_stock', in: 'query', description: 'Stock actual mínimo', schema: { type: 'number' } },
          { name: 'max_stock', in: 'query', description: 'Stock actual máximo', schema: { type: 'number' } },
          { name: 'min_costo', in: 'query', description: 'Costo unitario mínimo', schema: { type: 'number' } },
          { name: 'max_costo', in: 'query', description: 'Costo unitario máximo', schema: { type: 'number' } },
          { name: 'sortBy', in: 'query', description: 'Campo de ordenamiento', schema: { type: 'string', enum: ['codigo_profit', 'nombre_producto', 'codigo_categoria', 'categoria', 'costo', 'stock_act', 'almacen', 'sub_almacen', 'tipo'], default: 'nombre_producto' } },
          { name: 'sortOrder', in: 'query', description: 'Sentido del orden', schema: { type: 'string', enum: ['ASC', 'DESC'], default: 'ASC' } },
        ],
        responses: {
          200: {
            description: 'Listado paginado y filtrado de artículos retornado exitosamente',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    source: { type: 'string', example: '[AD_TRANS].[dbo].[vw_flota_articulos]' },
                    querySql: { type: 'string', example: 'SELECT [codigo_profit], [nombre_producto], [codigo_categoria], [categoria], [unidad_medida], [costo], [tipo], [codigo_subalmacen], [sub_almacen], [codigo_almacen], [almacen], [stock_act] FROM [AD_TRANS].[dbo].[vw_flota_articulos]' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          codigo_profit: { type: 'string', example: 'FRE-0234' },
                          nombre_producto: { type: 'string', example: 'Discos de freno delanteros ventilados' },
                          codigo_categoria: { type: 'string', example: 'FRE' },
                          categoria: { type: 'string', example: 'Frenos y Suspensión' },
                          unidad_medida: { type: 'string', example: 'PAR' },
                          costo: { type: 'number', example: 38.50 },
                          tipo: { type: 'string', example: 'Repuesto' },
                          codigo_subalmacen: { type: 'string', example: 'SUB-FRE' },
                          sub_almacen: { type: 'string', example: 'Frenos y Neumática' },
                          codigo_almacen: { type: 'string', example: 'TLL-01' },
                          almacen: { type: 'string', example: 'Taller Principal San Luis' },
                          stock_act: { type: 'number', example: 8.0 },
                        },
                      },
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        total: { type: 'integer', example: 12 },
                        page: { type: 'integer', example: 1 },
                        limit: { type: 'integer', example: 20 },
                        totalPages: { type: 'integer', example: 1 },
                        hasMore: { type: 'boolean', example: false },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/profit/flota-ordenes/stats': {
      get: {
        tags: ['Profit Plus MSSQL (AD_TRANS)'],
        summary: 'Obtener métricas y resumen de costos de órdenes de servicio en AD_TRANS',
        responses: {
          200: { description: 'Estadísticas agregadas' },
        },
      },
    },
    '/profit/flota-ordenes': {
      get: {
        tags: ['Profit Plus MSSQL (AD_TRANS)'],
        summary: 'Listar órdenes de servicio desde dbo.flota_ordenes_servicio con filtros y paginación',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'placa', in: 'query', schema: { type: 'string' } },
          { name: 'estatus', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Lista paginada de órdenes de servicio' },
        },
      },
      post: {
        tags: ['Profit Plus MSSQL (AD_TRANS)'],
        summary: 'Registrar nueva orden de servicio en dbo.flota_ordenes_servicio',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ProfitFlotaOrdenRequest' } } },
        },
        responses: {
          201: { description: 'Orden creada exitosamente en AD_TRANS' },
        },
      },
    },
    '/profit/flota-ordenes/{id}': {
      get: {
        tags: ['Profit Plus MSSQL (AD_TRANS)'],
        summary: 'Obtener orden de servicio por id_orden o nro_orden en AD_TRANS',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Detalle de la orden de servicio' },
          404: { description: 'Orden no encontrada' },
        },
      },
      put: {
        tags: ['Profit Plus MSSQL (AD_TRANS)'],
        summary: 'Actualizar orden de servicio en dbo.flota_ordenes_servicio',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ProfitFlotaOrdenUpdateRequest' } } },
        },
        responses: {
          200: { description: 'Orden actualizada exitosamente' },
        },
      },
      delete: {
        tags: ['Profit Plus MSSQL (AD_TRANS)'],
        summary: 'Eliminar orden de servicio de dbo.flota_ordenes_servicio',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Orden eliminada exitosamente' },
        },
      },
    },
    '/db-connections': {
      get: {
        tags: ['Conexiones de Base de Datos (ADMIN)'],
        summary: 'Listar conexiones de base de datos registradas en SQLite local (Paginado)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Lista paginada de conexiones de base de datos' },
        },
      },
      post: {
        tags: ['Conexiones de Base de Datos (ADMIN)'],
        summary: 'Registrar nueva conexión de base de datos (MSSQL / SQLite / Postgres)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['nombre', 'host', 'databaseName', 'username', 'password'],
                properties: {
                  nombre: { type: 'string', example: 'Servidor Profit Plus Producción (AD_TRANS)' },
                  host: { type: 'string', example: 'SRVBDPROFITBK' },
                  port: { type: 'integer', example: 1433 },
                  databaseName: { type: 'string', example: 'AD_TRANS' },
                  username: { type: 'string', example: 'solicitudweb' },
                  password: { type: 'string', example: 'solicitudweb' },
                  dialect: { type: 'string', example: 'mssql' },
                  trustServerCertificate: { type: 'boolean', example: true },
                  isDefault: { type: 'boolean', example: true },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Conexión registrada y probada' },
        },
      },
    },
    '/db-connections/{id}/test': {
      post: {
        tags: ['Conexiones de Base de Datos (ADMIN)'],
        summary: 'Probar conexión específica en vivo y medir latencia en ms',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Resultado de autenticación y latencia' },
        },
      },
    },
    '/db-connections/execute-query': {
      post: {
        tags: ['Conexiones de Base de Datos (ADMIN)'],
        summary: 'Ejecutar consulta SQL directa (ej. SELECT ... FROM [AD_TRANS].[dbo].[vw_flota_articulos])',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['query'],
                properties: {
                  query: {
                    type: 'string',
                    example: 'SELECT [codigo_profit], [nombre_producto], [codigo_categoria], [categoria], [unidad_medida], [costo], [tipo], [codigo_subalmacen], [sub_almacen], [codigo_almacen], [almacen], [stock_act] FROM [AD_TRANS].[dbo].[vw_flota_articulos]',
                  },
                  connectionId: { type: 'string' },
                  page: { type: 'integer', default: 1 },
                  limit: { type: 'integer', default: 50 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Filas, columnas y tiempo de ejecución en ms' },
        },
      },
    },
    '/roles-permissions': {
      get: {
        tags: ['Permisos por Rol y Usuario (RBAC)'],
        summary: 'Obtener matriz paginada de permisos por rol',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'role', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: {
          200: { description: 'Matriz de permisos por rol' },
        },
      },
    },
    '/roles-permissions/role/{role}': {
      get: {
        tags: ['Permisos por Rol y Usuario (RBAC)'],
        summary: 'Obtener permisos de un rol específico',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'role', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Lista de permisos del rol' },
        },
      },
      put: {
        tags: ['Permisos por Rol y Usuario (RBAC)'],
        summary: 'Actualizar en lote la matriz de permisos de un rol',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'role', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['permissions'],
                properties: {
                  permissions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        module: { type: 'string', example: 'taller' },
                        actions: { type: 'array', items: { type: 'string' }, example: ['read', 'create', 'update', 'approve'] },
                        description: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Matriz de permisos guardada exitosamente' },
        },
      },
    },
  },
};

export default swaggerDocument;
