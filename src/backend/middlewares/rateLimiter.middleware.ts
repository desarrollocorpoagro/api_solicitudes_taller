import rateLimit from 'express-rate-limit';

/**
 * Limitador estricto para rutas de autenticación y prevención de ataques de fuerza bruta.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 intentos por ventana
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    trustProxy: false,
  },
  message: {
    success: false,
    error: 'Demasiados intentos de autenticación desde esta dirección IP. Por favor intente más tarde.',
    code: 'RATE_LIMIT_AUTH_EXCEEDED',
  },
});

/**
 * Limitador general de la API para proteger contra saturación y DDoS.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 500, // 500 peticiones por minuto
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    trustProxy: false,
  },
  message: {
    success: false,
    error: 'Límite de peticiones excedido en la API. Por favor espere unos momentos.',
    code: 'RATE_LIMIT_API_EXCEEDED',
  },
});

