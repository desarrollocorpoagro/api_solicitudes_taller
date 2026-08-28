import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export interface ValidationSchema {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}

/**
 * Middleware para validar esquemas de datos con Joi en body, query y params.
 */
export const validateJoi = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: Array<{ field: string; message: string }> = [];

    if (schema.params) {
      const { error } = schema.params.validate(req.params, { abortEarly: false });
      if (error) {
        error.details.forEach((d) => {
          errors.push({ field: `params.${d.path.join('.')}`, message: d.message.replace(/"/g, '') });
        });
      }
    }

    if (schema.query) {
      const { error } = schema.query.validate(req.query, { abortEarly: false });
      if (error) {
        error.details.forEach((d) => {
          errors.push({ field: `query.${d.path.join('.')}`, message: d.message.replace(/"/g, '') });
        });
      }
    }

    if (schema.body) {
      const { error } = schema.body.validate(req.body, { abortEarly: false });
      if (error) {
        error.details.forEach((d) => {
          errors.push({ field: `body.${d.path.join('.')}`, message: d.message.replace(/"/g, '') });
        });
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Error de validación en la solicitud.',
        details: errors,
        code: 'VALIDATION_ERROR',
      });
    }

    return next();
  };
};
