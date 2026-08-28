import { Request, Response } from 'express';
import { RolePermission, UserPermission, User } from '../models';
import { logger } from '../utils/logger';

export class RolePermissionController {
  /**
   * Obtiene la matriz completa de permisos por roles
   */
  static async getAllRolePermissions(req: Request, res: Response) {
    try {
      const { role, module, page = 1, limit = 50 } = req.query;

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));
      const offset = (pageNum - 1) * limitNum;

      const where: any = {};
      if (role) where.role = String(role).toUpperCase();
      if (module) where.module = String(module).toLowerCase();

      const { count, rows } = await RolePermission.findAndCountAll({
        where,
        limit: limitNum,
        offset,
        order: [
          ['role', 'ASC'],
          ['module', 'ASC'],
        ],
      });

      const totalPages = Math.ceil(count / limitNum);

      return res.json({
        success: true,
        count: rows.length,
        data: rows,
        pagination: {
          total: count,
          page: pageNum,
          limit: limitNum,
          totalPages,
          hasMore: pageNum < totalPages,
        },
      });
    } catch (error: any) {
      logger.error(`[RolePermissionController] Error al listar permisos: ${error.message}`);
      return res.status(500).json({ success: false, error: 'Error al obtener matriz de permisos.' });
    }
  }

  /**
   * Obtiene los permisos específicos asignados a un rol
   */
  static async getPermissionsByRole(req: Request, res: Response) {
    try {
      const { role } = req.params;
      const cleanRole = role.toUpperCase();

      const permissions = await RolePermission.findAll({
        where: { role: cleanRole },
        order: [['module', 'ASC']],
      });

      return res.json({
        success: true,
        role: cleanRole,
        count: permissions.length,
        data: permissions,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Actualiza o crea la configuración de permisos para un rol y módulo
   */
  static async updateRolePermissions(req: Request, res: Response) {
    try {
      const { role } = req.params;
      const { module, actions, description } = req.body;

      const cleanRole = role.toUpperCase();
      const cleanModule = (module || '').toLowerCase().trim();

      if (!cleanModule) {
        return res.status(400).json({ success: false, error: 'El módulo es obligatorio.' });
      }

      if (!Array.isArray(actions)) {
        return res.status(400).json({ success: false, error: 'El campo "actions" debe ser un arreglo de acciones.' });
      }

      let perm = await RolePermission.findOne({
        where: { role: cleanRole, module: cleanModule },
      });

      if (perm) {
        perm.actions = actions;
        if (description !== undefined) perm.description = description;
        await perm.save();
      } else {
        perm = await RolePermission.create({
          role: cleanRole,
          module: cleanModule,
          actions,
          description: description || `Permisos para módulo ${cleanModule} en rol ${cleanRole}`,
        });
      }

      logger.info(`[RolePermissionController] Permisos actualizados para rol ${cleanRole} en módulo ${cleanModule}`);
      return res.json({
        success: true,
        message: `Permisos del rol ${cleanRole} para el módulo ${cleanModule} actualizados con éxito.`,
        data: perm,
      });
    } catch (error: any) {
      logger.error(`[RolePermissionController] Error al guardar permisos: ${error.message}`);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Actualiza en lote toda la matriz de permisos de un rol
   */
  static async bulkUpdateRole(req: Request, res: Response) {
    try {
      const { role } = req.params;
      const { permissions } = req.body; // Array de { module, actions, description }

      const cleanRole = role.toUpperCase();

      if (!Array.isArray(permissions)) {
        return res.status(400).json({ success: false, error: 'Se esperaba un arreglo en el campo "permissions".' });
      }

      for (const p of permissions) {
        if (!p.module || !Array.isArray(p.actions)) continue;
        const cleanMod = p.module.toLowerCase().trim();

        const [entry] = await RolePermission.findOrCreate({
          where: { role: cleanRole, module: cleanMod },
          defaults: {
            role: cleanRole,
            module: cleanMod,
            actions: p.actions,
            description: p.description || `Módulo ${cleanMod}`,
          },
        });

        entry.actions = p.actions;
        if (p.description) entry.description = p.description;
        await entry.save();
      }

      const updated = await RolePermission.findAll({
        where: { role: cleanRole },
        order: [['module', 'ASC']],
      });

      logger.info(`[RolePermissionController] Permisos masivos actualizados para rol ${cleanRole}`);
      return res.json({
        success: true,
        message: `Matriz de permisos para ${cleanRole} guardada satisfactoriamente.`,
        data: updated,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Obtiene las excepciones o permisos personalizados por usuario
   */
  static async getUserPermissions(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const user = await User.findByPk(userId);

      if (!user) {
        return res.status(404).json({ success: false, error: 'Usuario no encontrado.' });
      }

      const userPerms = await UserPermission.findAll({
        where: { userId },
        order: [['module', 'ASC']],
      });

      const rolePerms = await RolePermission.findAll({
        where: { role: user.role },
        order: [['module', 'ASC']],
      });

      return res.json({
        success: true,
        user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
        rolePermissions: rolePerms,
        customUserPermissions: userPerms,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Guarda permisos personalizados específicos para un usuario
   */
  static async updateUserPermissions(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { permissions } = req.body; // Array de { module, actions, isGranted, notes }

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ success: false, error: 'Usuario no encontrado.' });
      }

      if (!Array.isArray(permissions)) {
        return res.status(400).json({ success: false, error: 'Se esperaba un arreglo de permisos.' });
      }

      await UserPermission.destroy({ where: { userId } });

      const created = [];
      for (const p of permissions) {
        if (!p.module || !Array.isArray(p.actions)) continue;
        const entry = await UserPermission.create({
          userId,
          module: p.module.toLowerCase().trim(),
          actions: p.actions,
          isGranted: p.isGranted !== undefined ? Boolean(p.isGranted) : true,
          notes: p.notes || null,
        });
        created.push(entry);
      }

      logger.info(`[RolePermissionController] Permisos personalizados actualizados para usuario ${user.email}`);
      return res.json({
        success: true,
        message: `Permisos personalizados para ${user.fullName} guardados exitosamente.`,
        data: created,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}
