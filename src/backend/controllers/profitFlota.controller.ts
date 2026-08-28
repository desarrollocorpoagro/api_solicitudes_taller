import { Request, Response } from 'express';
import { Op, fn, col } from 'sequelize';
import FlotaOrdenServicioProfit from '../models/FlotaOrdenServicioProfit.model';
import VwFlotaVendedores from '../models/VwFlotaVendedores.model';
import VwFlotaArticulos from '../models/VwFlotaArticulos.model';
import MecanicosProfit from '../models/MecanicosProfit.model';
import { getProfitConnectionStatus, profitSequelize } from '../config/profitDb';
import { logger } from '../utils/logger';

export class ProfitFlotaController {
  /**
   * Verifica y reporta el estado de la conexión MSSQL al servidor Profit (SRVBDPROFITBK / AD_TRANS).
   */
  public static async testConnection(_req: Request, res: Response): Promise<Response> {
    try {
      const status = await getProfitConnectionStatus();
      return res.json({
        success: status.connected,
        ...status,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error(`[ProfitFlotaController] Error probando conexión a Profit: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: error.message || 'Error al conectar con la base de datos Profit MSSQL AD_TRANS',
      });
    }
  }

  /**
   * Obtiene el listado de órdenes de servicio registradas en dbo.flota_ordenes_servicio.
   */
  public static async getAll(req: Request, res: Response): Promise<Response> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const offset = (page - 1) * limit;

      const { search, placa, estatus, es_reincidencia, fecha_desde, fecha_hasta, sortBy = 'fec_apertura', sortOrder = 'DESC' } = req.query;

      const whereClause: any = {};

      if (placa) {
        whereClause.Placa = { [Op.like]: `%${String(placa).trim()}%` };
      }

      if (estatus) {
        whereClause.estatus = String(estatus).trim();
      }

      if (es_reincidencia !== undefined && es_reincidencia !== '') {
        whereClause.es_reincidencia = String(es_reincidencia).toLowerCase() === 'true' || String(es_reincidencia) === '1';
      }

      if (fecha_desde || fecha_hasta) {
        whereClause.fec_apertura = {};
        if (fecha_desde) {
          whereClause.fec_apertura[Op.gte] = new Date(String(fecha_desde));
        }
        if (fecha_hasta) {
          whereClause.fec_apertura[Op.lte] = new Date(String(fecha_hasta));
        }
      }

      if (search) {
        const searchTerm = `%${String(search).trim()}%`;
        whereClause[Op.or] = [
          { nro_orden: { [Op.like]: searchTerm } },
          { Placa: { [Op.like]: searchTerm } },
          { recibido_por: { [Op.like]: searchTerm } },
          { entregado_por: { [Op.like]: searchTerm } },
          { sintomas_reportados: { [Op.like]: searchTerm } },
        ];
      }

      const { count, rows } = await FlotaOrdenServicioProfit.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [[String(sortBy), String(sortOrder).toUpperCase()]],
      });

      return res.json({
        success: true,
        data: rows,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      });
    } catch (error: any) {
      logger.error(`[ProfitFlotaController] Error al consultar órdenes de servicio: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Error al consultar las órdenes de servicio en la base de datos de Profit (AD_TRANS)',
        details: error.message,
      });
    }
  }

  /**
   * Obtiene una orden de servicio individual por su id_orden (numérico) o nro_orden (código).
   */
  public static async getById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      const isNumeric = /^\d+$/.test(id);
      const whereCondition = isNumeric ? { [Op.or]: [{ id_orden: parseInt(id, 10) }, { nro_orden: id }] } : { nro_orden: id };

      const orden = await FlotaOrdenServicioProfit.findOne({ where: whereCondition });

      if (!orden) {
        return res.status(404).json({
          success: false,
          error: `No se encontró ninguna orden de servicio con identificador '${id}' en AD_TRANS`,
        });
      }

      return res.json({
        success: true,
        data: orden,
      });
    } catch (error: any) {
      logger.error(`[ProfitFlotaController] Error al obtener orden ${req.params.id}: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Error al consultar el detalle de la orden en AD_TRANS',
        details: error.message,
      });
    }
  }

  /**
   * Crea una nueva orden de servicio en dbo.flota_ordenes_servicio.
   */
  public static async create(req: Request, res: Response): Promise<Response> {
    try {
      const {
        nro_orden,
        Placa,
        km_horometro,
        recibido_por,
        entregado_por,
        fec_apertura,
        fec_cierre,
        sintomas_reportados,
        es_reincidencia = false,
        nro_orden_anterior,
        motivo_reincidencia,
        fotos_adjuntas = 0,
        estatus = 'ABIERTA',
        costo_repuestos = 0,
        costo_mano_obra = 0,
        costo_servicios_ext = 0,
        costo_total,
        recibe_conforme,
        hora_apertura,
        hora_cierre,
      } = req.body;

      // 1. Verificar si ya existe una orden con ese nro_orden
      const existing = await FlotaOrdenServicioProfit.findOne({ where: { nro_orden } });
      if (existing) {
        return res.status(409).json({
          success: false,
          error: `Ya existe una orden de servicio registrada con el número '${nro_orden}'`,
        });
      }

      // 2. Calcular costo_total si no se envía explícitamente
      const computedTotal =
        costo_total !== undefined && costo_total !== null
          ? parseFloat(costo_total)
          : parseFloat((Number(costo_repuestos) + Number(costo_mano_obra) + Number(costo_servicios_ext)).toFixed(2));

      // 3. Crear registro
      const nuevaOrden = await FlotaOrdenServicioProfit.create({
        nro_orden: String(nro_orden).trim().toUpperCase(),
        Placa: String(Placa).trim().toUpperCase(),
        km_horometro: parseFloat(km_horometro),
        recibido_por: String(recibido_por).trim(),
        entregado_por: entregado_por ? String(entregado_por).trim() : null,
        fec_apertura: fec_apertura ? new Date(fec_apertura) : new Date(),
        fec_cierre: fec_cierre ? new Date(fec_cierre) : null,
        sintomas_reportados: String(sintomas_reportados).trim(),
        es_reincidencia: Boolean(es_reincidencia),
        nro_orden_anterior: nro_orden_anterior ? String(nro_orden_anterior).trim() : null,
        motivo_reincidencia: motivo_reincidencia ? String(motivo_reincidencia).trim() : null,
        fotos_adjuntas: parseInt(fotos_adjuntas, 10) || 0,
        estatus: String(estatus).trim().toUpperCase(),
        costo_repuestos: parseFloat(costo_repuestos) || 0.0,
        costo_mano_obra: parseFloat(costo_mano_obra) || 0.0,
        costo_servicios_ext: parseFloat(costo_servicios_ext) || 0.0,
        costo_total: computedTotal,
        recibe_conforme: recibe_conforme ? String(recibe_conforme).trim() : null,
        hora_apertura: hora_apertura ? new Date(hora_apertura) : new Date(),
        hora_cierre: hora_cierre ? new Date(hora_cierre) : null,
      });

      logger.info(`[ProfitFlotaController] Nueva orden creada en AD_TRANS: ${nuevaOrden.nro_orden} (ID: ${nuevaOrden.id_orden})`);

      return res.status(201).json({
        success: true,
        message: 'Orden de servicio registrada exitosamente en AD_TRANS',
        data: nuevaOrden,
      });
    } catch (error: any) {
      logger.error(`[ProfitFlotaController] Error al crear orden en AD_TRANS: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Error al registrar la orden de servicio en la base de datos de Profit (AD_TRANS)',
        details: error.message,
      });
    }
  }

  /**
   * Actualiza una orden de servicio existente por su id_orden o nro_orden.
   */
  public static async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const isNumeric = /^\d+$/.test(id);
      const whereCondition = isNumeric ? { [Op.or]: [{ id_orden: parseInt(id, 10) }, { nro_orden: id }] } : { nro_orden: id };

      const orden = await FlotaOrdenServicioProfit.findOne({ where: whereCondition });

      if (!orden) {
        return res.status(404).json({
          success: false,
          error: `No se encontró ninguna orden de servicio con identificador '${id}'`,
        });
      }

      const updates: any = { ...req.body };

      // Si se actualizan costos, recalcular costo_total
      const repuestos = updates.costo_repuestos !== undefined ? parseFloat(updates.costo_repuestos) : orden.costo_repuestos;
      const manoObra = updates.costo_mano_obra !== undefined ? parseFloat(updates.costo_mano_obra) : orden.costo_mano_obra;
      const externos = updates.costo_servicios_ext !== undefined ? parseFloat(updates.costo_servicios_ext) : orden.costo_servicios_ext;

      if (updates.costo_total === undefined) {
        updates.costo_total = parseFloat((repuestos + manoObra + externos).toFixed(2));
      }

      // Si el estatus pasa a CERRADA y no hay fec_cierre, asignar fecha y hora actual
      if (updates.estatus && updates.estatus.toUpperCase() === 'CERRADA' && !orden.fec_cierre && !updates.fec_cierre) {
        updates.fec_cierre = new Date();
        updates.hora_cierre = new Date();
      }

      await orden.update(updates);

      logger.info(`[ProfitFlotaController] Orden ${orden.nro_orden} (ID: ${orden.id_orden}) actualizada en AD_TRANS`);

      return res.json({
        success: true,
        message: 'Orden de servicio actualizada exitosamente en AD_TRANS',
        data: orden,
      });
    } catch (error: any) {
      logger.error(`[ProfitFlotaController] Error al actualizar orden ${req.params.id}: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Error al actualizar la orden en AD_TRANS',
        details: error.message,
      });
    }
  }

  /**
   * Elimina una orden de servicio de dbo.flota_ordenes_servicio.
   */
  public static async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const isNumeric = /^\d+$/.test(id);
      const whereCondition = isNumeric ? { [Op.or]: [{ id_orden: parseInt(id, 10) }, { nro_orden: id }] } : { nro_orden: id };

      const orden = await FlotaOrdenServicioProfit.findOne({ where: whereCondition });

      if (!orden) {
        return res.status(404).json({
          success: false,
          error: `No se encontró ninguna orden de servicio con identificador '${id}'`,
        });
      }

      const deletedNro = orden.nro_orden;
      await orden.destroy();

      logger.warn(`[ProfitFlotaController] Orden eliminada de AD_TRANS: ${deletedNro}`);

      return res.json({
        success: true,
        message: `Orden de servicio '${deletedNro}' eliminada correctamente de AD_TRANS`,
      });
    } catch (error: any) {
      logger.error(`[ProfitFlotaController] Error al eliminar orden ${req.params.id}: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Error al eliminar la orden de servicio en AD_TRANS',
        details: error.message,
      });
    }
  }

  /**
   * Retorna métricas y estadísticas agregadas de las órdenes de servicio en AD_TRANS.
   */
  public static async getEstadisticas(_req: Request, res: Response): Promise<Response> {
    try {
      const totalOrdenes = await FlotaOrdenServicioProfit.count();
      const abiertas = await FlotaOrdenServicioProfit.count({ where: { estatus: 'ABIERTA' } });
      const enProceso = await FlotaOrdenServicioProfit.count({ where: { estatus: 'EN PROCESO' } });
      const cerradas = await FlotaOrdenServicioProfit.count({ where: { estatus: 'CERRADA' } });
      const reincidencias = await FlotaOrdenServicioProfit.count({ where: { es_reincidencia: true } });

      const sumTotals = await FlotaOrdenServicioProfit.findOne({
        attributes: [
          [fn('SUM', col('costo_repuestos')), 'totalRepuestos'],
          [fn('SUM', col('costo_mano_obra')), 'totalManoObra'],
          [fn('SUM', col('costo_servicios_ext')), 'totalExternos'],
          [fn('SUM', col('costo_total')), 'totalGeneral'],
        ],
        raw: true,
      }) as any;

      return res.json({
        success: true,
        data: {
          resumen: {
            total: totalOrdenes,
            abiertas,
            enProceso,
            cerradas,
            reincidencias,
          },
          costosAcumulados: {
            repuestos: parseFloat(sumTotals?.totalRepuestos || '0'),
            manoObra: parseFloat(sumTotals?.totalManoObra || '0'),
            serviciosExternos: parseFloat(sumTotals?.totalExternos || '0'),
            totalGeneral: parseFloat(sumTotals?.totalGeneral || '0'),
          },
        },
      });
    } catch (error: any) {
      logger.error(`[ProfitFlotaController] Error obteniendo estadísticas: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Error al calcular estadísticas de órdenes en AD_TRANS',
        details: error.message,
      });
    }
  }

  /**
   * @route GET /api/v1/profit/vendedores
   * @desc Obtiene la lista de vendedores / responsables de flota desde [AD_TRANS].[dbo].[vw_flota_vendedores]
   * SELECT [co_ven], [cedula], [ven_des] FROM [AD_TRANS].[dbo].[vw_flota_vendedores]
   */
  public static async getVendedores(req: Request, res: Response): Promise<Response> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const offset = (page - 1) * limit;

      const {
        search,
        q,
        co_ven,
        cedula,
        ven_des,
        nombre,
        sortBy = 'ven_des',
        sortOrder = 'ASC',
      } = req.query;

      const whereClause: any = {};

      if (co_ven) {
        whereClause.co_ven = { [Op.like]: `%${String(co_ven).trim()}%` };
      }

      if (cedula) {
        whereClause.cedula = { [Op.like]: `%${String(cedula).trim()}%` };
      }

      const descTerm = ven_des || nombre;
      if (descTerm) {
        whereClause.ven_des = { [Op.like]: `%${String(descTerm).trim()}%` };
      }

      const globalSearch = search || q;
      if (globalSearch) {
        const searchTerm = `%${String(globalSearch).trim()}%`;
        whereClause[Op.or] = [
          { co_ven: { [Op.like]: searchTerm } },
          { cedula: { [Op.like]: searchTerm } },
          { ven_des: { [Op.like]: searchTerm } },
        ];
      }

      const allowedSort = ['co_ven', 'cedula', 'ven_des'];
      const finalSortBy = allowedSort.includes(String(sortBy)) ? String(sortBy) : 'ven_des';
      const finalSortOrder = String(sortOrder).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

      const { count, rows } = await VwFlotaVendedores.findAndCountAll({
        attributes: ['co_ven', 'cedula', 'ven_des'],
        where: whereClause,
        limit,
        offset,
        order: [[finalSortBy, finalSortOrder]],
      });

      return res.json({
        success: true,
        source: '[AD_TRANS].[dbo].[vw_flota_vendedores]',
        querySql: 'SELECT [co_ven], [cedula], [ven_des] FROM [AD_TRANS].[dbo].[vw_flota_vendedores]',
        data: rows,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
          hasMore: page * limit < count,
        },
        filtrosAplicados: {
          search: globalSearch || null,
          co_ven: co_ven || null,
          cedula: cedula || null,
          ven_des: descTerm || null,
          sortBy: finalSortBy,
          sortOrder: finalSortOrder,
        },
      });
    } catch (error: any) {
      logger.error(`[ProfitFlotaController] Error consultando vw_flota_vendedores: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Error al consultar la vista de vendedores en AD_TRANS (vw_flota_vendedores)',
        details: error.message,
      });
    }
  }

  /**
   * @route GET /api/v1/profit/articulos
   * @desc Obtiene la lista de artículos y repuestos de flota desde [AD_TRANS].[dbo].[vw_flota_articulos]
   * SELECT [codigo_profit], [nombre_producto], [codigo_categoria], [categoria], [unidad_medida],
   *        [costo], [tipo], [codigo_subalmacen], [sub_almacen], [codigo_almacen], [almacen], [stock_act]
   * FROM [AD_TRANS].[dbo].[vw_flota_articulos]
   */
  public static async getArticulos(req: Request, res: Response): Promise<Response> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const offset = (page - 1) * limit;

      const {
        search,
        q,
        codigo_profit,
        nombre_producto,
        codigo_categoria,
        categoria,
        unidad_medida,
        tipo,
        codigo_subalmacen,
        sub_almacen,
        codigo_almacen,
        almacen,
        con_stock,
        min_stock,
        max_stock,
        min_costo,
        max_costo,
        sortBy = 'nombre_producto',
        sortOrder = 'ASC',
      } = req.query;

      const whereClause: any = {};

      if (codigo_profit) {
        whereClause.codigo_profit = { [Op.like]: `%${String(codigo_profit).trim()}%` };
      }

      if (nombre_producto) {
        whereClause.nombre_producto = { [Op.like]: `%${String(nombre_producto).trim()}%` };
      }

      if (codigo_categoria) {
        whereClause.codigo_categoria = String(codigo_categoria).trim();
      }

      if (categoria) {
        whereClause.categoria = { [Op.like]: `%${String(categoria).trim()}%` };
      }

      if (unidad_medida) {
        whereClause.unidad_medida = String(unidad_medida).trim();
      }

      if (tipo) {
        whereClause.tipo = { [Op.like]: `%${String(tipo).trim()}%` };
      }

      if (codigo_subalmacen) {
        whereClause.codigo_subalmacen = String(codigo_subalmacen).trim();
      }

      if (sub_almacen) {
        whereClause.sub_almacen = { [Op.like]: `%${String(sub_almacen).trim()}%` };
      }

      if (codigo_almacen) {
        whereClause.codigo_almacen = String(codigo_almacen).trim();
      }

      if (almacen) {
        whereClause.almacen = { [Op.like]: `%${String(almacen).trim()}%` };
      }

      // Filtro booleano con_stock
      if (con_stock !== undefined && con_stock !== '') {
        const hasStock = String(con_stock).toLowerCase() === 'true' || String(con_stock) === '1';
        if (hasStock) {
          whereClause.stock_act = { [Op.gt]: 0 };
        } else {
          whereClause.stock_act = { [Op.lte]: 0 };
        }
      }

      // Rango de stock
      if ((min_stock !== undefined && min_stock !== '') || (max_stock !== undefined && max_stock !== '')) {
        whereClause.stock_act = whereClause.stock_act || {};
        if (min_stock !== undefined && min_stock !== '') {
          whereClause.stock_act[Op.gte] = parseFloat(String(min_stock));
        }
        if (max_stock !== undefined && max_stock !== '') {
          whereClause.stock_act[Op.lte] = parseFloat(String(max_stock));
        }
      }

      // Rango de costo
      if ((min_costo !== undefined && min_costo !== '') || (max_costo !== undefined && max_costo !== '')) {
        whereClause.costo = whereClause.costo || {};
        if (min_costo !== undefined && min_costo !== '') {
          whereClause.costo[Op.gte] = parseFloat(String(min_costo));
        }
        if (max_costo !== undefined && max_costo !== '') {
          whereClause.costo[Op.lte] = parseFloat(String(max_costo));
        }
      }

      // Búsqueda global
      const globalSearch = search || q;
      if (globalSearch) {
        const searchTerm = `%${String(globalSearch).trim()}%`;
        whereClause[Op.or] = [
          { codigo_profit: { [Op.like]: searchTerm } },
          { nombre_producto: { [Op.like]: searchTerm } },
          { categoria: { [Op.like]: searchTerm } },
          { sub_almacen: { [Op.like]: searchTerm } },
          { almacen: { [Op.like]: searchTerm } },
          { tipo: { [Op.like]: searchTerm } },
        ];
      }

      const allowedSort = [
        'codigo_profit',
        'nombre_producto',
        'codigo_categoria',
        'categoria',
        'unidad_medida',
        'costo',
        'tipo',
        'codigo_subalmacen',
        'sub_almacen',
        'codigo_almacen',
        'almacen',
        'stock_act',
      ];
      const finalSortBy = allowedSort.includes(String(sortBy)) ? String(sortBy) : 'nombre_producto';
      const finalSortOrder = String(sortOrder).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

      const { count, rows } = await VwFlotaArticulos.findAndCountAll({
        attributes: [
          'codigo_profit',
          'nombre_producto',
          'codigo_categoria',
          'categoria',
          'unidad_medida',
          'costo',
          'tipo',
          'codigo_subalmacen',
          'sub_almacen',
          'codigo_almacen',
          'almacen',
          'stock_act',
        ],
        where: whereClause,
        limit,
        offset,
        order: [[finalSortBy, finalSortOrder]],
      });

      return res.json({
        success: true,
        source: '[AD_TRANS].[dbo].[vw_flota_articulos]',
        querySql: 'SELECT [codigo_profit], [nombre_producto], [codigo_categoria], [categoria], [unidad_medida], [costo], [tipo], [codigo_subalmacen], [sub_almacen], [codigo_almacen], [almacen], [stock_act] FROM [AD_TRANS].[dbo].[vw_flota_articulos]',
        data: rows,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
          hasMore: page * limit < count,
        },
        filtrosAplicados: {
          search: globalSearch || null,
          codigo_profit: codigo_profit || null,
          nombre_producto: nombre_producto || null,
          codigo_categoria: codigo_categoria || null,
          categoria: categoria || null,
          unidad_medida: unidad_medida || null,
          tipo: tipo || null,
          codigo_subalmacen: codigo_subalmacen || null,
          sub_almacen: sub_almacen || null,
          codigo_almacen: codigo_almacen || null,
          almacen: almacen || null,
          con_stock: con_stock !== undefined && con_stock !== '' ? con_stock : null,
          min_stock: min_stock || null,
          max_stock: max_stock || null,
          min_costo: min_costo || null,
          max_costo: max_costo || null,
          sortBy: finalSortBy,
          sortOrder: finalSortOrder,
        },
      });
    } catch (error: any) {
      logger.error(`[ProfitFlotaController] Error consultando vw_flota_articulos: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Error al consultar la vista de artículos en AD_TRANS (vw_flota_articulos)',
        details: error.message,
      });
    }
  }

  /**
   * @route GET /api/v1/profit/mecanicos
   * @desc Obtiene la lista de mecánicos y personal de taller desde [ad_trans].[dbo].[mecanicos]
   * SELECT [codigo], [nombre], [cargo], [activo] FROM [ad_trans].[dbo].[mecanicos]
   */
  public static async getMecanicos(req: Request, res: Response): Promise<Response> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const offset = (page - 1) * limit;

      const { search, q, codigo, nombre, cargo, activo, sortBy = 'nombre', sortOrder = 'ASC' } = req.query;

      const whereClause: any = {};

      if (codigo) {
        whereClause.codigo = { [Op.like]: `%${String(codigo).trim()}%` };
      }

      if (nombre) {
        whereClause.nombre = { [Op.like]: `%${String(nombre).trim()}%` };
      }

      if (cargo) {
        whereClause.cargo = { [Op.like]: `%${String(cargo).trim()}%` };
      }

      if (activo !== undefined && activo !== '') {
        const isActivo = String(activo).toLowerCase() === 'true' || String(activo) === '1';
        whereClause.activo = isActivo;
      }

      const globalSearch = search || q;
      if (globalSearch) {
        const searchTerm = `%${String(globalSearch).trim()}%`;
        whereClause[Op.or] = [
          { codigo: { [Op.like]: searchTerm } },
          { nombre: { [Op.like]: searchTerm } },
          { cargo: { [Op.like]: searchTerm } },
        ];
      }

      const allowedSort = ['codigo', 'nombre', 'cargo', 'activo'];
      const finalSortBy = allowedSort.includes(String(sortBy)) ? String(sortBy) : 'nombre';
      const finalSortOrder = String(sortOrder).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

      const { count, rows } = await MecanicosProfit.findAndCountAll({
        attributes: ['codigo', 'nombre', 'cargo', 'activo'],
        where: whereClause,
        limit,
        offset,
        order: [[finalSortBy, finalSortOrder]],
      });

      return res.json({
        success: true,
        source: '[ad_trans].[dbo].[mecanicos]',
        querySql: 'SELECT [codigo], [nombre], [cargo], [activo] FROM [ad_trans].[dbo].[mecanicos]',
        data: rows,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
          hasMore: page * limit < count,
        },
        filtrosAplicados: {
          search: globalSearch || null,
          codigo: codigo || null,
          nombre: nombre || null,
          cargo: cargo || null,
          activo: activo !== undefined && activo !== '' ? activo : null,
          sortBy: finalSortBy,
          sortOrder: finalSortOrder,
        },
      });
    } catch (error: any) {
      logger.error(`[ProfitFlotaController] Error consultando mecanicos: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Error al consultar la tabla de mecánicos en AD_TRANS (ad_trans.dbo.mecanicos)',
        details: error.message,
      });
    }
  }
}

