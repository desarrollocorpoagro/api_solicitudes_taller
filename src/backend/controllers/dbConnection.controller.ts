import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { DatabaseConnection } from '../models/DatabaseConnection.model';
import { DbConnectionService } from '../services/dbConnection.service';
import { logger } from '../utils/logger';

export class DbConnectionController {
  /**
   * Obtiene la lista paginada de conexiones de base de datos registradas en SQLite
   */
  static async getAllConnections(req: Request, res: Response) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        dialect,
        isActive,
        sortBy = 'createdAt',
        sortOrder = 'DESC',
      } = req.query;

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const where: any = {};

      if (dialect) {
        where.dialect = String(dialect).toLowerCase();
      }

      if (isActive !== undefined) {
        where.isActive = String(isActive) === 'true';
      }

      if (search) {
        const q = String(search).trim();
        where[Op.or] = [
          { nombre: { [Op.like]: `%${q}%` } },
          { host: { [Op.like]: `%${q}%` } },
          { databaseName: { [Op.like]: `%${q}%` } },
          { username: { [Op.like]: `%${q}%` } },
        ];
      }

      const allowedSort = ['nombre', 'host', 'databaseName', 'dialect', 'status', 'createdAt', 'lastTestedAt'];
      const orderField = allowedSort.includes(String(sortBy)) ? String(sortBy) : 'createdAt';
      const orderDir = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      const { count, rows } = await DatabaseConnection.findAndCountAll({
        where,
        limit: limitNum,
        offset,
        order: [[orderField, orderDir]],
      });

      // Ocultar contraseñas en listado
      const safeRows = rows.map((conn) => {
        const json = conn.toJSON();
        delete json.password;
        return json;
      });

      const totalPages = Math.ceil(count / limitNum);

      return res.json({
        success: true,
        count: safeRows.length,
        data: safeRows,
        pagination: {
          total: count,
          page: pageNum,
          limit: limitNum,
          totalPages,
          hasMore: pageNum < totalPages,
        },
      });
    } catch (error: any) {
      logger.error(`[DbConnectionController] Error al obtener conexiones: ${error.message}`);
      return res.status(500).json({ success: false, error: 'Error al listar conexiones de base de datos.' });
    }
  }

  /**
   * Obtiene una conexión por su ID
   */
  static async getConnectionById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const connection = await DatabaseConnection.findByPk(id);

      if (!connection) {
        return res.status(404).json({ success: false, error: 'Conexión de base de datos no encontrada.' });
      }

      const safe = connection.toJSON();
      delete safe.password;

      return res.json({ success: true, data: safe });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Registra una nueva configuración de conexión a base de datos (MSSQL / SQLite / Postgres)
   */
  static async createConnection(req: Request, res: Response) {
    try {
      const {
        nombre,
        host,
        port,
        databaseName,
        username,
        password,
        dialect,
        trustServerCertificate,
        encrypt,
        options,
        isDefault,
        isActive,
      } = req.body;

      if (isDefault) {
        await DatabaseConnection.update({ isDefault: false }, { where: {} });
      }

      const connection = await DatabaseConnection.create({
        nombre: nombre || `Conexión ${dialect || 'mssql'} - ${databaseName || 'AD_TRANS'}`,
        host: host || 'SRVBDPROFITBK',
        port: port || 1433,
        databaseName: databaseName || 'AD_TRANS',
        username: username || 'solicitudweb',
        password: password || 'solicitudweb',
        dialect: (dialect || 'mssql').toLowerCase(),
        trustServerCertificate: trustServerCertificate !== undefined ? Boolean(trustServerCertificate) : true,
        encrypt: encrypt !== undefined ? Boolean(encrypt) : false,
        options: options || {},
        isDefault: Boolean(isDefault),
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        status: 'STANDBY',
      });

      // Probar conexión inmediatamente
      const testRes = await DbConnectionService.testConnectionConfig({
        dialect: connection.dialect,
        host: connection.host,
        port: connection.port,
        databaseName: connection.databaseName,
        username: connection.username,
        password: connection.password,
        trustServerCertificate: connection.trustServerCertificate,
        encrypt: connection.encrypt,
      });

      connection.status = testRes.connected ? 'CONNECTED' : 'ERROR';
      connection.lastTestedAt = new Date();
      connection.latencyMs = testRes.latencyMs;
      connection.lastError = testRes.error;
      await connection.save();

      const safe = connection.toJSON();
      delete safe.password;

      logger.info(`[DbConnectionController] Conexión registrada: ${connection.nombre} (${connection.dialect})`);
      return res.status(201).json({
        success: true,
        message: 'Conexión de base de datos registrada exitosamente.',
        data: safe,
        testResult: testRes,
      });
    } catch (error: any) {
      logger.error(`[DbConnectionController] Error al crear conexión: ${error.message}`);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Actualiza los parámetros de una conexión existente
   */
  static async updateConnection(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const {
        nombre,
        host,
        port,
        databaseName,
        username,
        password,
        dialect,
        trustServerCertificate,
        encrypt,
        options,
        isDefault,
        isActive,
      } = req.body;

      const connection = await DatabaseConnection.findByPk(id);
      if (!connection) {
        return res.status(404).json({ success: false, error: 'Conexión no encontrada.' });
      }

      if (isDefault) {
        await DatabaseConnection.update({ isDefault: false }, { where: {} });
      }

      if (nombre) connection.nombre = nombre;
      if (host) connection.host = host;
      if (port) connection.port = port;
      if (databaseName) connection.databaseName = databaseName;
      if (username) connection.username = username;
      if (password) connection.password = password;
      if (dialect) connection.dialect = dialect.toLowerCase();
      if (trustServerCertificate !== undefined) connection.trustServerCertificate = Boolean(trustServerCertificate);
      if (encrypt !== undefined) connection.encrypt = Boolean(encrypt);
      if (options !== undefined) connection.options = options;
      if (isDefault !== undefined) connection.isDefault = Boolean(isDefault);
      if (isActive !== undefined) connection.isActive = Boolean(isActive);

      await connection.save();

      const safe = connection.toJSON();
      delete safe.password;

      logger.info(`[DbConnectionController] Conexión actualizada: ${connection.nombre}`);
      return res.json({
        success: true,
        message: 'Conexión de base de datos actualizada exitosamente.',
        data: safe,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Elimina una conexión
   */
  static async deleteConnection(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const connection = await DatabaseConnection.findByPk(id);
      if (!connection) {
        return res.status(404).json({ success: false, error: 'Conexión no encontrada.' });
      }

      if (connection.isDefault) {
        return res.status(400).json({
          success: false,
          error: 'No se puede eliminar la conexión predeterminada del sistema. Asigne otra como predeterminada primero.',
        });
      }

      await connection.destroy();
      logger.info(`[DbConnectionController] Conexión eliminada: ${connection.nombre}`);
      return res.json({ success: true, message: 'Conexión eliminada correctamente.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Prueba una conexión por ID o con parámetros ad-hoc
   */
  static async testConnection(req: Request, res: Response) {
    try {
      const { id } = req.params;
      let config: any;

      if (id && id !== 'adhoc') {
        const connection = await DatabaseConnection.findByPk(id);
        if (!connection) {
          return res.status(404).json({ success: false, error: 'Conexión no encontrada.' });
        }
        config = {
          dialect: connection.dialect,
          host: connection.host,
          port: connection.port,
          databaseName: connection.databaseName,
          username: connection.username,
          password: connection.password,
          trustServerCertificate: connection.trustServerCertificate,
          encrypt: connection.encrypt,
          options: connection.options,
        };

        const testRes = await DbConnectionService.testConnectionConfig(config);

        connection.status = testRes.connected ? 'CONNECTED' : 'ERROR';
        connection.lastTestedAt = new Date();
        connection.latencyMs = testRes.latencyMs;
        connection.lastError = testRes.error;
        await connection.save();

        return res.json({
          success: true,
          connectionId: id,
          nombre: connection.nombre,
          ...testRes,
        });
      } else {
        config = req.body;
        const testRes = await DbConnectionService.testConnectionConfig(config);
        return res.json({
          success: true,
          ...testRes,
        });
      }
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Ejecuta una consulta SQL directa (Raw Query)
   * Ejemplo: SELECT [codigo_profit], [nombre_producto], [codigo_categoria], [categoria],
   * [unidad_medida], [costo], [tipo], [codigo_subalmacen], [sub_almacen], [codigo_almacen],
   * [almacen], [stock_act] FROM [AD_TRANS].[dbo].[vw_flota_articulos]
   */
  static async executeQuery(req: Request, res: Response) {
    try {
      const { query, connectionId, page = 1, limit = 50 } = req.body;

      if (!query || typeof query !== 'string' || !query.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Debe proporcionar la sentencia SQL a ejecutar en el campo "query".',
        });
      }

      const result = await DbConnectionService.executeDirectQuery(query, connectionId);

      // Paginación en memoria si la consulta retorna muchos registros
      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.min(500, Math.max(1, parseInt(String(limit), 10) || 50));
      const total = result.rows.length;
      const totalPages = Math.ceil(total / limitNum) || 1;
      const paginatedRows = result.rows.slice((pageNum - 1) * limitNum, pageNum * limitNum);

      return res.json({
        ...result,
        rows: paginatedRows,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages,
          hasMore: pageNum < totalPages,
        },
      });
    } catch (error: any) {
      logger.error(`[DbConnectionController] Error en executeQuery: ${error.message}`);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}
