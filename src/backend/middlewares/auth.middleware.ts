import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  type: 'PRE_AUTH' | 'FULL_AUTH';
  companyId?: string;
  role?: string;
  permissions?: Array<{ module: string; actions: string[] }>;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      tenantId?: string;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'SanLuis_SuperSecret_JWT_2026';
const JWT_PREAUTH_SECRET = process.env.JWT_PREAUTH_SECRET || JWT_SECRET;

/**
 * Middleware para verificar tokens JWT con niveles de autorización PRE_AUTH y FULL_AUTH.
 */
export const authenticateToken = (expectedType: 'PRE_AUTH' | 'FULL_AUTH' = 'FULL_AUTH') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Acceso denegado. Token JWT no proporcionado en la cabecera Authorization.',
        code: 'AUTH_TOKEN_MISSING',
      });
    }

    try {
      // Usar el secreto apropiado según el tipo o intentar con JWT_SECRET
      let decoded: AuthenticatedUser;
      try {
        decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
      } catch {
        decoded = jwt.verify(token, JWT_PREAUTH_SECRET) as AuthenticatedUser;
      }

      if (expectedType === 'FULL_AUTH' && decoded.type !== 'FULL_AUTH') {
        return res.status(403).json({
          success: false,
          error: 'Token inválido para el nivel de acceso requerido. Debe completar la selección de empresa (FULL_AUTH).',
          code: 'AUTH_LEVEL_INSUFFICIENT',
        });
      }

      req.user = decoded;
      if (decoded.companyId) {
        req.tenantId = decoded.companyId;
      }
      next();
    } catch (err: any) {
      logger.warn(`[AuthMiddleware] Token inválido o expirado: ${err.message}`);
      return res.status(401).json({
        success: false,
        error: 'Token JWT inválido o expirado. Por favor inicie sesión nuevamente.',
        code: 'AUTH_TOKEN_INVALID',
      });
    }
  };
};

/**
 * Middleware para validar roles específicos en rutas protegidas.
 */
export const requireRoles = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        error: 'No posee un rol asignado para realizar esta acción.',
        code: 'ROLE_MISSING',
      });
    }

    const userRole = req.user.role.toUpperCase();
    const allowed = roles.map((r) => r.toUpperCase());

    if (userRole === 'ADMIN' || allowed.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: `Acceso restringido. Se requiere uno de los siguientes roles: ${roles.join(', ')}.`,
      code: 'ROLE_UNAUTHORIZED',
    });
  };
};
