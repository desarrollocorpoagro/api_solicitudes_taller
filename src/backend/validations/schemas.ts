import Joi from 'joi';

// 1. Autenticación
export const loginSchema = {
  body: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'El formato del correo electrónico es inválido.',
      'any.required': 'El correo electrónico es obligatorio.',
    }),
    password: Joi.string().min(6).required().messages({
      'string.min': 'La contraseña debe tener al menos 6 caracteres.',
      'any.required': 'La contraseña es obligatoria.',
    }),
  }),
};

export const selectCompanySchema = {
  body: Joi.object({
    companyId: Joi.string().uuid().required().messages({
      'string.guid': 'El ID de la empresa debe ser un UUID válido.',
      'any.required': 'El ID de la empresa es obligatorio.',
    }),
  }),
};

// 2. Usuarios
export const createUserSchema = {
  body: Joi.object({
    fullName: Joi.string().min(3).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    phone: Joi.string().allow('', null),
    role: Joi.string().valid('ADMIN', 'GERENTE_TALLER', 'MECANICO', 'RESPONSABLE_FLOTA', 'ALMACENISTA', 'OPERADOR').default('OPERADOR'),
    isActive: Joi.boolean().default(true),
  }),
};

export const updateUserSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    fullName: Joi.string().min(3).max(100),
    email: Joi.string().email(),
    password: Joi.string().min(6).allow('', null),
    phone: Joi.string().allow('', null),
    role: Joi.string().valid('ADMIN', 'GERENTE_TALLER', 'MECANICO', 'RESPONSABLE_FLOTA', 'ALMACENISTA', 'OPERADOR'),
    isActive: Joi.boolean(),
  }),
};

// 3. Empresas / Tenants
export const createCompanySchema = {
  body: Joi.object({
    name: Joi.string().min(2).max(150).required(),
    taxId: Joi.string().min(3).max(20).required(),
    email: Joi.string().email().allow('', null),
    phone: Joi.string().allow('', null),
  }),
};

export const assignUserCompanySchema = {
  body: Joi.object({
    companyId: Joi.string().uuid().required(),
    role: Joi.string().valid('ADMIN', 'GERENTE_TALLER', 'MECANICO', 'RESPONSABLE_FLOTA', 'ALMACENISTA', 'OPERADOR').required(),
    permissions: Joi.array().items(
      Joi.object({
        module: Joi.string().required(),
        actions: Joi.array().items(Joi.string()).required(),
      })
    ).optional(),
  }),
};

// 4. Órdenes de Servicio (Taller San Luis)
export const createOrdenServicioSchema = {
  body: Joi.object({
    placa: Joi.string().uppercase().trim().min(3).max(20).required().messages({
      'any.required': 'La placa del vehículo es obligatoria.',
    }),
    km: Joi.number().integer().min(0).required().messages({
      'any.required': 'El kilometraje / horómetro es obligatorio.',
    }),
    recibidoPor: Joi.string().min(2).max(100).required().messages({
      'any.required': 'El campo Recibido por es obligatorio.',
    }),
    entregadoPor: Joi.string().max(100).allow('', null),
    sintomas: Joi.string().min(5).required().messages({
      'any.required': 'Los síntomas reportados son obligatorios.',
    }),
    esReincidencia: Joi.boolean().default(false),
    osAnterior: Joi.string().allow('', null),
    motivoReincidencia: Joi.string().allow('', null),
  }),
};

export const cerrarOrdenServicioSchema = {
  params: Joi.object({
    id: Joi.string().required(),
  }),
  body: Joi.object({
    fechaEntrega: Joi.date().iso().allow('', null),
    recibeConforme: Joi.string().min(2).max(100).required().messages({
      'any.required': 'El nombre de quien recibe conforme es obligatorio para el cierre.',
    }),
  }),
};

// 5. Órdenes de Área (OT)
export const createOrdenAreaSchema = {
  params: Joi.object({
    id: Joi.string().required(),
  }),
  body: Joi.object({
    area: Joi.string().valid(
      'Mtto preventivo',
      'Reparaciones mayores',
      'Mtto correctivo',
      'Metalmecánica',
      'Latonería y pintura',
      'Cauchera',
      'Lavado'
    ).required(),
    fechaRecepcion: Joi.date().iso().default(Date.now),
    mecanico: Joi.string().min(2).max(100).required(),
    diagnostico: Joi.string().allow('', null),
    horas: Joi.number().min(0).default(0),
  }),
};

export const updateOrdenAreaSchema = {
  params: Joi.object({
    id: Joi.string().required(),
    otId: Joi.string().required(),
  }),
  body: Joi.object({
    diagnostico: Joi.string().allow('', null),
    horas: Joi.number().min(0),
    estado: Joi.string().valid('abierta', 'cerrada'),
  }),
};

// 6. Solicitudes de Repuesto
export const createSolicitudRepuestoSchema = {
  params: Joi.object({
    id: Joi.string().required(),
  }),
  body: Joi.object({
    otId: Joi.string().required(),
    cod: Joi.string().required(),
    cant: Joi.number().integer().min(1).required(),
    motivo: Joi.string().allow('', null),
  }),
};

// 7. Solicitudes de Servicio Externo
export const createSolicitudExternoSchema = {
  params: Joi.object({
    id: Joi.string().required(),
  }),
  body: Joi.object({
    otId: Joi.string().required(),
    proveedor: Joi.string().min(2).max(150).required(),
    descripcion: Joi.string().min(3).required(),
    conGarantia: Joi.boolean().default(false),
    ordenOrigenGarantia: Joi.when('conGarantia', {
      is: true,
      then: Joi.string().required().messages({
        'any.required': 'Debe especificar la orden de origen para aplicar la garantía.',
      }),
      otherwise: Joi.string().allow('', null),
    }),
    costoCotizado: Joi.number().min(0).default(0),
  }),
};

// 8. Aprobaciones
export const aprobacionActionSchema = {
  params: Joi.object({
    tipo: Joi.string().valid('repuesto', 'externo').required(),
    id: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    accion: Joi.string().valid('APROBAR', 'RECHAZAR').required(),
    comentario: Joi.string().allow('', null),
  }),
};

// 9. Despacho Almacén
export const despachoAlmacenSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    accion: Joi.string().valid('DESPACHAR').required(),
  }),
};

// 10. Notificaciones
export const createNotificacionSchema = {
  body: Joi.object({
    tipo: Joi.string().valid('EMAIL', 'PUSH', 'SISTEMA').required(),
    canal: Joi.string().default('orden_servicio'),
    destinatarioEmail: Joi.string().email().allow('', null),
    titulo: Joi.string().min(3).max(200).required(),
    mensaje: Joi.string().min(3).required(),
    datos: Joi.object().optional(),
  }),
};

// 11. Agente IA
export const aiQuerySchema = {
  body: Joi.object({
    prompt: Joi.string().min(2).required(),
    agentType: Joi.string().valid('orchestrator', 'fleet', 'agronomy').default('orchestrator'),
    context: Joi.object().optional(),
  }),
};
