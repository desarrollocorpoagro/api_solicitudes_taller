import { Router } from 'express';
import { CompanyController } from '../controllers/company.controller';
import { validateJoi } from '../middlewares/validate.middleware';
import { createCompanySchema } from '../validations/schemas';
import { authenticateToken, requireRoles } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', CompanyController.getAllCompanies);
router.get('/:id', CompanyController.getCompanyById);
router.post('/', authenticateToken('FULL_AUTH'), requireRoles(['ADMIN']), validateJoi(createCompanySchema), CompanyController.createCompany);
router.put('/:id', authenticateToken('FULL_AUTH'), requireRoles(['ADMIN']), CompanyController.updateCompany);

export default router;
