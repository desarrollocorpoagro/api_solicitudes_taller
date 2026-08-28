import Joi from 'joi';

export const createProfitOrdenSchema = {
  body: Joi.object({
    nro_orden: Joi.string().max(20).required().messages({
      'any.required': 'El nro_orden es obligatorio',
      'string.max': 'El nro_orden no puede superar 20 caracteres',
    }),
    Placa: Joi.string().max(50).required().messages({
      'any.required': 'La Placa del vehículo es obligatoria',
      'string.max': 'La Placa no puede superar 50 caracteres',
    }),
    km_horometro: Joi.number().min(0).precision(2).required().messages({
      'any.required': 'El km_horometro es obligatorio',
      'number.base': 'El km_horometro debe ser un valor numérico',
    }),
    recibido_por: Joi.string().max(100).required().messages({
      'any.required': 'El campo recibido_por es obligatorio',
      'string.max': 'El campo recibido_por no puede superar 100 caracteres',
    }),
    entregado_por: Joi.string().max(100).allow(null, '').optional(),
    fec_apertura: Joi.date().iso().optional(),
    fec_cierre: Joi.date().iso().allow(null).optional(),
    sintomas_reportados: Joi.string().required().messages({
      'any.required': 'Los sintomas_reportados son obligatorios',
    }),
    es_reincidencia: Joi.boolean().default(false),
    nro_orden_anterior: Joi.string().max(20).allow(null, '').optional(),
    motivo_reincidencia: Joi.string().max(100).allow(null, '').optional(),
    fotos_adjuntas: Joi.number().integer().min(0).default(0),
    estatus: Joi.string().valid('ABIERTA', 'EN PROCESO', 'CERRADA', 'ANULADA', 'PENDIENTE_REPUESTOS').default('ABIERTA'),
    costo_repuestos: Joi.number().min(0).precision(2).default(0.0),
    costo_mano_obra: Joi.number().min(0).precision(2).default(0.0),
    costo_servicios_ext: Joi.number().min(0).precision(2).default(0.0),
    costo_total: Joi.number().min(0).precision(2).optional(),
    recibe_conforme: Joi.string().max(100).allow(null, '').optional(),
    hora_apertura: Joi.date().iso().allow(null).optional(),
    hora_cierre: Joi.date().iso().allow(null).optional(),
  }),
};

export const updateProfitOrdenSchema = {
  params: Joi.object({
    id: Joi.string().required().messages({
      'any.required': 'El identificador id_orden o nro_orden es obligatorio',
    }),
  }),
  body: Joi.object({
    nro_orden: Joi.string().max(20).optional(),
    Placa: Joi.string().max(50).optional(),
    km_horometro: Joi.number().min(0).precision(2).optional(),
    recibido_por: Joi.string().max(100).optional(),
    entregado_por: Joi.string().max(100).allow(null, '').optional(),
    fec_apertura: Joi.date().iso().optional(),
    fec_cierre: Joi.date().iso().allow(null).optional(),
    sintomas_reportados: Joi.string().optional(),
    es_reincidencia: Joi.boolean().optional(),
    nro_orden_anterior: Joi.string().max(20).allow(null, '').optional(),
    motivo_reincidencia: Joi.string().max(100).allow(null, '').optional(),
    fotos_adjuntas: Joi.number().integer().min(0).optional(),
    estatus: Joi.string().valid('ABIERTA', 'EN PROCESO', 'CERRADA', 'ANULADA', 'PENDIENTE_REPUESTOS').optional(),
    costo_repuestos: Joi.number().min(0).precision(2).optional(),
    costo_mano_obra: Joi.number().min(0).precision(2).optional(),
    costo_servicios_ext: Joi.number().min(0).precision(2).optional(),
    costo_total: Joi.number().min(0).precision(2).optional(),
    recibe_conforme: Joi.string().max(100).allow(null, '').optional(),
    hora_apertura: Joi.date().iso().allow(null).optional(),
    hora_cierre: Joi.date().iso().allow(null).optional(),
  }),
};

export const queryProfitOrdenSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().allow('', null).optional(),
    placa: Joi.string().allow('', null).optional(),
    estatus: Joi.string().allow('', null).optional(),
    es_reincidencia: Joi.boolean().optional(),
    fecha_desde: Joi.date().iso().optional(),
    fecha_hasta: Joi.date().iso().optional(),
    sortBy: Joi.string().valid('id_orden', 'nro_orden', 'fec_apertura', 'costo_total', 'estatus').default('fec_apertura'),
    sortOrder: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('DESC'),
  }),
};

export const queryVendedoresSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(1000).default(20),
    search: Joi.string().allow('', null).optional(),
    q: Joi.string().allow('', null).optional(),
    co_ven: Joi.string().allow('', null).optional(),
    cedula: Joi.string().allow('', null).optional(),
    ven_des: Joi.string().allow('', null).optional(),
    nombre: Joi.string().allow('', null).optional(),
    sortBy: Joi.string().valid('co_ven', 'cedula', 'ven_des').default('ven_des'),
    sortOrder: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('ASC'),
  }),
};

export const queryArticulosSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(1000).default(20),
    search: Joi.string().allow('', null).optional(),
    q: Joi.string().allow('', null).optional(),
    codigo_profit: Joi.string().allow('', null).optional(),
    nombre_producto: Joi.string().allow('', null).optional(),
    codigo_categoria: Joi.string().allow('', null).optional(),
    categoria: Joi.string().allow('', null).optional(),
    unidad_medida: Joi.string().allow('', null).optional(),
    tipo: Joi.string().allow('', null).optional(),
    codigo_subalmacen: Joi.string().allow('', null).optional(),
    sub_almacen: Joi.string().allow('', null).optional(),
    codigo_almacen: Joi.string().allow('', null).optional(),
    almacen: Joi.string().allow('', null).optional(),
    con_stock: Joi.boolean().optional(),
    min_stock: Joi.number().min(0).optional(),
    max_stock: Joi.number().min(0).optional(),
    min_costo: Joi.number().min(0).optional(),
    max_costo: Joi.number().min(0).optional(),
    sortBy: Joi.string().valid('codigo_profit', 'nombre_producto', 'codigo_categoria', 'categoria', 'costo', 'stock_act', 'almacen', 'sub_almacen', 'tipo', 'unidad_medida').default('nombre_producto'),
    sortOrder: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('ASC'),
  }),
};

export const queryMecanicosSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(1000).default(20),
    search: Joi.string().allow('', null).optional(),
    q: Joi.string().allow('', null).optional(),
    codigo: Joi.string().allow('', null).optional(),
    nombre: Joi.string().allow('', null).optional(),
    cargo: Joi.string().allow('', null).optional(),
    activo: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false', '1', '0')).optional(),
    sortBy: Joi.string().valid('codigo', 'nombre', 'cargo', 'activo').default('nombre'),
    sortOrder: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('ASC'),
  }),
};


