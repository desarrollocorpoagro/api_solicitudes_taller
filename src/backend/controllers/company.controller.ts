import { Request, Response } from 'express';
import { Company, UserCompany } from '../models';
import { logger } from '../utils/logger';

export class CompanyController {
  static async getAllCompanies(req: Request, res: Response) {
    try {
      const companies = await Company.findAll({
        order: [['name', 'ASC']],
      });
      return res.json({ success: true, count: companies.length, data: companies });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getCompanyById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const company = await Company.findByPk(id);
      if (!company) return res.status(404).json({ success: false, error: 'Empresa no encontrada.' });
      return res.json({ success: true, data: company });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async createCompany(req: Request, res: Response) {
    try {
      const { name, taxId, email, phone } = req.body;
      const existing = await Company.findOne({ where: { taxId: taxId.trim() } });
      if (existing) {
        return res.status(400).json({ success: false, error: 'Ya existe una empresa registrada con este RIF/NIT.' });
      }

      const company = await Company.create({ name, taxId, email, phone, isActive: true });
      logger.info(`[CompanyController] Empresa creada: ${name} (RIF: ${taxId})`);
      return res.status(201).json({ success: true, message: 'Empresa registrada con éxito.', data: company });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async updateCompany(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, taxId, email, phone, isActive } = req.body;
      const company = await Company.findByPk(id);
      if (!company) return res.status(404).json({ success: false, error: 'Empresa no encontrada.' });

      if (name) company.name = name;
      if (taxId) company.taxId = taxId;
      if (email !== undefined) company.email = email;
      if (phone !== undefined) company.phone = phone;
      if (isActive !== undefined) company.isActive = isActive;

      await company.save();
      return res.json({ success: true, message: 'Empresa actualizada.', data: company });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default CompanyController;
