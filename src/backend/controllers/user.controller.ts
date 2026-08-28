import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { User, Company, UserCompany } from '../models';
import { logger } from '../utils/logger';

export class UserController {
  /**
   * Obtiene la lista con paginación, filtros y búsqueda de usuarios con sus empresas asociadas.
   */
  static async getAllUsers(req: Request, res: Response) {
    try {
      const {
        page,
        limit,
        search,
        role,
        companyId,
        isActive,
        sortBy = 'createdAt',
        sortOrder = 'DESC',
      } = req.query;

      const where: any = {};

      if (role) {
        where.role = String(role).toUpperCase();
      }

      if (isActive !== undefined) {
        where.isActive = String(isActive) === 'true';
      }

      if (search) {
        const q = String(search).trim();
        where[Op.or] = [
          { fullName: { [Op.like]: `%${q}%` } },
          { email: { [Op.like]: `%${q}%` } },
          { phone: { [Op.like]: `%${q}%` } },
          { role: { [Op.like]: `%${q}%` } },
        ];
      }

      const allowedSort = ['fullName', 'email', 'role', 'isActive', 'createdAt'];
      const orderField = allowedSort.includes(String(sortBy)) ? String(sortBy) : 'createdAt';
      const orderDir = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      const userCompanyInclude: any = {
        model: UserCompany,
        as: 'userCompanies',
        include: [{ model: Company, as: 'company' }],
      };

      if (companyId) {
        userCompanyInclude.where = { companyId: String(companyId) };
      }

      // Si se especifica page o limit, paginar
      if (page !== undefined || limit !== undefined) {
        const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
        const offset = (pageNum - 1) * limitNum;

        const { count, rows } = await User.findAndCountAll({
          where,
          attributes: { exclude: ['password'] },
          include: [userCompanyInclude],
          order: [[orderField, orderDir]],
          limit: limitNum,
          offset,
          distinct: true,
        });

        const totalPages = Math.ceil(count / limitNum) || 1;

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
      }

      // Consulta completa sin paginación explícita
      const users = await User.findAll({
        where,
        attributes: { exclude: ['password'] },
        include: [userCompanyInclude],
        order: [[orderField, orderDir]],
      });

      return res.json({
        success: true,
        count: users.length,
        data: users,
        pagination: {
          total: users.length,
          page: 1,
          limit: users.length,
          totalPages: 1,
          hasMore: false,
        },
      });
    } catch (error: any) {
      logger.error(`[UserController] Error al obtener usuarios: ${error.message}`);
      return res.status(500).json({ success: false, error: 'Error al listar usuarios.' });
    }
  }

  /**
   * Obtiene el detalle de un usuario por ID.
   */
  static async getUserById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = await User.findByPk(id, {
        attributes: { exclude: ['password'] },
        include: [
          {
            model: UserCompany,
            as: 'userCompanies',
            include: [{ model: Company, as: 'company' }],
          },
        ],
      });

      if (!user) {
        return res.status(404).json({ success: false, error: 'Usuario no encontrado.' });
      }

      return res.json({ success: true, data: user });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Crea un nuevo usuario en el sistema.
   */
  static async createUser(req: Request, res: Response) {
    try {
      const { fullName, email, password, role, phone, isActive } = req.body;

      const existing = await User.findOne({ where: { email: email.toLowerCase().trim() } });
      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'Ya existe un usuario registrado con este correo electrónico.',
        });
      }

      const user = await User.create({
        fullName,
        email: email.toLowerCase().trim(),
        password,
        role: role || 'OPERADOR',
        phone,
        isActive: isActive !== undefined ? isActive : true,
      });

      // Asignar empresas si se envía arreglo de companyIds o assignedCompanies
      const companyIds: string[] = req.body.companyIds || (req.body.companyId ? [req.body.companyId] : []);
      const assignedCompanies = req.body.assignedCompanies;

      if (Array.isArray(assignedCompanies) && assignedCompanies.length > 0) {
        for (const ac of assignedCompanies) {
          if (ac.companyId) {
            await UserCompany.create({
              userId: user.id,
              companyId: ac.companyId,
              role: ac.role || user.role,
              permissions: ac.permissions || [
                { module: 'taller', actions: ['read', 'create', 'update'] },
                { module: 'fleet', actions: ['read'] },
              ],
            });
          }
        }
      } else if (companyIds.length > 0) {
        for (const cId of companyIds) {
          await UserCompany.create({
            userId: user.id,
            companyId: cId,
            role: user.role,
            permissions: [
              { module: 'taller', actions: ['read', 'create', 'update'] },
              { module: 'fleet', actions: ['read'] },
            ],
          });
        }
      } else if (req.tenantId) {
        await UserCompany.create({
          userId: user.id,
          companyId: req.tenantId,
          role: user.role,
          permissions: [
            { module: 'taller', actions: ['read', 'create', 'update'] },
            { module: 'fleet', actions: ['read'] },
          ],
        });
      }

      const createdUser = await User.findByPk(user.id, {
        attributes: { exclude: ['password'] },
        include: [{ model: UserCompany, as: 'userCompanies' }],
      });

      logger.info(`[UserController] Usuario creado: ${user.email} (Rol: ${user.role})`);
      return res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente.',
        data: createdUser,
      });
    } catch (error: any) {
      logger.error(`[UserController] Error al crear usuario: ${error.message}`);
      return res.status(500).json({ success: false, error: 'Error al registrar usuario.' });
    }
  }

  /**
   * Actualiza los datos de un usuario existente.
   */
  static async updateUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { fullName, email, password, role, phone, isActive } = req.body;

      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'Usuario no encontrado.' });
      }

      if (email && email.toLowerCase().trim() !== user.email) {
        const emailInUse = await User.findOne({ where: { email: email.toLowerCase().trim() } });
        if (emailInUse) {
          return res.status(400).json({ success: false, error: 'El correo electrónico ya está en uso por otro usuario.' });
        }
        user.email = email.toLowerCase().trim();
      }

      if (fullName) user.fullName = fullName;
      if (role) user.role = role;
      if (phone !== undefined) user.phone = phone;
      if (isActive !== undefined) user.isActive = isActive;
      if (password && password.trim().length >= 6) {
        user.password = await bcrypt.hash(password, 10);
      }

      await user.save();

      // Si se envía companyIds o assignedCompanies, actualizar asociaciones
      const companyIds: string[] | undefined = req.body.companyIds;
      const assignedCompanies = req.body.assignedCompanies;

      if (Array.isArray(assignedCompanies)) {
        await UserCompany.destroy({ where: { userId: id } });
        for (const ac of assignedCompanies) {
          if (ac.companyId) {
            await UserCompany.create({
              userId: id,
              companyId: ac.companyId,
              role: ac.role || user.role,
              permissions: ac.permissions || [
                { module: 'taller', actions: ['read', 'create', 'update'] },
                { module: 'fleet', actions: ['read'] },
              ],
            });
          }
        }
      } else if (Array.isArray(companyIds)) {
        await UserCompany.destroy({ where: { userId: id } });
        for (const cId of companyIds) {
          await UserCompany.create({
            userId: id,
            companyId: cId,
            role: user.role,
            permissions: [
              { module: 'taller', actions: ['read', 'create', 'update'] },
              { module: 'fleet', actions: ['read'] },
            ],
          });
        }
      }

      const updatedUser = await User.findByPk(id, {
        attributes: { exclude: ['password'] },
        include: [{ model: UserCompany, as: 'userCompanies', include: [{ model: Company, as: 'company' }] }],
      });

      logger.info(`[UserController] Usuario actualizado: ${user.email}`);
      return res.json({
        success: true,
        message: 'Usuario actualizado exitosamente.',
        data: updatedUser,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Elimina o desactiva un usuario.
   */
  static async deleteUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'Usuario no encontrado.' });
      }

      await UserCompany.destroy({ where: { userId: id } });
      await user.destroy();

      logger.info(`[UserController] Usuario eliminado: ${user.email}`);
      return res.json({
        success: true,
        message: 'Usuario eliminado del sistema.',
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Asigna un usuario a una empresa con rol y permisos específicos.
   */
  static async assignCompany(req: Request, res: Response) {
    try {
      const { id: userId } = req.params;
      const { companyId, role, permissions } = req.body;

      const user = await User.findByPk(userId);
      if (!user) return res.status(404).json({ success: false, error: 'Usuario no encontrado.' });

      const company = await Company.findByPk(companyId);
      if (!company) return res.status(404).json({ success: false, error: 'Empresa no encontrada.' });

      let userCompany = await UserCompany.findOne({ where: { userId, companyId } });
      if (userCompany) {
        userCompany.role = role || userCompany.role;
        if (permissions) userCompany.permissions = permissions;
        await userCompany.save();
      } else {
        userCompany = await UserCompany.create({
          userId,
          companyId,
          role: role || user.role,
          permissions: permissions || [
            { module: 'taller', actions: ['read', 'create', 'update'] },
            { module: 'fleet', actions: ['read'] },
          ],
        });
      }

      logger.info(`[UserController] Asignación de empresa ${company.name} actualizada para usuario ${user.email}`);
      return res.json({
        success: true,
        message: 'Asignación de empresa y permisos actualizada con éxito.',
        data: userCompany,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default UserController;
