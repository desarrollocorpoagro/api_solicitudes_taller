import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validateJoi } from '../middlewares/validate.middleware';
import { loginSchema, selectCompanySchema } from '../validations/schemas';
import { authenticateToken } from '../middlewares/auth.middleware';
import { authRateLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();

router.post(
  '/login',
  authRateLimiter,
  validateJoi(loginSchema),
  AuthController.login
);

router.post(
  '/select-company',
  authRateLimiter,
  authenticateToken('PRE_AUTH'),
  validateJoi(selectCompanySchema),
  AuthController.selectCompany
);

router.get(
  '/me',
  authenticateToken('FULL_AUTH'),
  AuthController.me
);

export default router;
