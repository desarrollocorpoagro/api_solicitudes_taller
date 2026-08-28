import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Company, UserCompany } from '../models';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'SanLuis_SuperSecret_JWT_2026';
const JWT_PREAUTH_SECRET = process.env.JWT_PREAUTH_SECRET || JWT_SECRET;
const PREAUTH_TTL = process.env.PREAUTH_TTL || '15m';
const SESSION_TTL = process.env.SESSION_TTL || '8h';

export class AuthController {
  /**
   * Paso 1: Autenticación de credenciales de usuario y emisión de Pre-Auth Token.
   */
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({
        where: { email: email.toLowerCase().trim(), isActive: true },
        include: [
          {
            model: UserCompany,
            as: 'userCompanies',
            include: [{ model: Company, as: 'company', where: { isActive: true } }],
          },
        ],
      });

      if (!user) {
        logger.warn(`[AuthController] Intento de login fallido para: ${email} (Usuario no encontrado)`);
        return res.status(401).json({
          success: false,
          error: 'Credenciales inválidas. Verifique el correo o contraseña.',
          code: 'INVALID_CREDENTIALS',
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        logger.warn(`[AuthController] Intento de login fallido para: ${email} (Contraseña incorrecta)`);
        return res.status(401).json({
          success: false,
          error: 'Credenciales inválidas. Verifique el correo o contraseña.',
          code: 'INVALID_CREDENTIALS',
        });
      }

      // Si el rol es ADMIN, tiene acceso total a TODAS las empresas activas del Grupo San Luis
      let assignedCompanies: Array<{
        id: string;
        name: string;
        taxId: string;
        role: string;
        permissions: any;
      }> = [];

      if (user.role && user.role.toUpperCase() === 'ADMIN') {
        const allActiveCompanies = await Company.findAll({
          where: { isActive: true },
          order: [['name', 'ASC']],
        });
        assignedCompanies = allActiveCompanies.map((c) => ({
          id: c.id,
          name: c.name,
          taxId: c.taxId,
          role: 'ADMIN',
          permissions: [{ module: '*', actions: ['create', 'read', 'update', 'delete', 'approve', 'admin'] }],
        }));
      } else {
        assignedCompanies = (user.userCompanies || []).map((uc: any) => ({
          id: uc.company.id,
          name: uc.company.name,
          taxId: uc.company.taxId,
          role: uc.role,
          permissions: uc.permissions,
        }));
      }

      if (assignedCompanies.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'El usuario no tiene empresas activas asignadas en el sistema.',
          code: 'NO_COMPANIES_ASSIGNED',
        });
      }

      // Generación de Token de Pre-Autenticación
      const preAuthToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          type: 'PRE_AUTH',
        },
        JWT_PREAUTH_SECRET,
        { expiresIn: PREAUTH_TTL as any }
      );

      logger.info(`[AuthController] Login exitoso (Paso 1) para: ${email} con ${assignedCompanies.length} empresas.`);

      return res.json({
        success: true,
        message: 'Autenticación exitosa. Seleccione una empresa para continuar.',
        preAuthToken,
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        },
        companies: assignedCompanies,
      });
    } catch (error: any) {
      logger.error(`[AuthController] Error en login: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Error interno en el servidor durante la autenticación.',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
  }

  /**
   * Paso 2: Selección de Tenant y emisión de Token Final de Sesión Multi-Tenant.
   */
  static async selectCompany(req: Request, res: Response) {
    try {
      const { companyId } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Sesión no válida o token de pre-autenticación ausente.',
          code: 'UNAUTHORIZED_SESSION',
        });
      }

      const user = await User.findByPk(userId);
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          error: 'Usuario no encontrado o inactivo.',
          code: 'USER_INACTIVE',
        });
      }

      let selectedCompany: Company | null = null;
      let effectiveRole = user.role;
      let effectivePermissions = [
        { module: '*', actions: ['create', 'read', 'update', 'delete', 'approve', 'admin'] },
      ];

      // Si el usuario tiene rol ADMIN global, puede acceder a CUALQUIER empresa activa
      if (user.role && user.role.toUpperCase() === 'ADMIN') {
        selectedCompany = await Company.findOne({
          where: { id: companyId, isActive: true },
        });

        if (!selectedCompany) {
          logger.warn(`[AuthController] Empresa ${companyId} no encontrada o inactiva`);
          return res.status(404).json({
            success: false,
            error: 'La empresa solicitada no existe o no se encuentra activa en el sistema.',
            code: 'COMPANY_NOT_FOUND',
          });
        }
      } else {
        // Prevención de IDOR para usuarios no ADMIN: Validar asignación en UserCompany
        const userCompany = await UserCompany.findOne({
          where: { userId, companyId },
          include: [{ model: Company, as: 'company' }],
        });

        if (!userCompany || !userCompany.company || !userCompany.company.isActive) {
          logger.warn(`[AuthController] Intento de acceso no autorizado a empresa ${companyId} por usuario ${userId}`);
          return res.status(403).json({
            success: false,
            error: 'No posee autorización para acceder a la empresa solicitada.',
            code: 'FORBIDDEN_TENANT_ACCESS',
          });
        }

        selectedCompany = userCompany.company;
        effectiveRole = userCompany.role;
        effectivePermissions = userCompany.permissions;
      }

      // Token JWT Final de Sesión Multi-Tenant
      const finalToken = jwt.sign(
        {
          userId: user.id,
          companyId: selectedCompany.id,
          role: effectiveRole,
          permissions: effectivePermissions,
          type: 'FULL_AUTH',
        },
        JWT_SECRET,
        { expiresIn: SESSION_TTL as any }
      );

      logger.info(`[AuthController] Acceso a empresa concedido: ${selectedCompany.name} para usuario ${userId} (Rol: ${effectiveRole})`);

      return res.json({
        success: true,
        message: 'Acceso a empresa concedido.',
        token: finalToken,
        activeCompany: {
          id: selectedCompany.id,
          name: selectedCompany.name,
          taxId: selectedCompany.taxId,
          role: effectiveRole,
          permissions: effectivePermissions,
        },
      });
    } catch (error: any) {
      logger.error(`[AuthController] Error al seleccionar empresa: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Error interno al procesar la selección de empresa.',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
  }

  /**
   * Obtiene la información del usuario en la sesión activa.
   */
  static async me(req: Request, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ success: false, error: 'No autenticado' });
      }

      const user = await User.findByPk(req.user.userId, {
        attributes: { exclude: ['password'] },
      });

      let company = null;
      if (req.user.companyId) {
        company = await Company.findByPk(req.user.companyId);
      }

      return res.json({
        success: true,
        user,
        activeCompany: company,
        session: req.user,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default AuthController;
