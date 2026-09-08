import { fn, col, where, WhereOptions } from 'sequelize';

/**
 * Produce una condición WHERE que compara la columna `cod` contra un valor
 * ignorando los espacios de relleno (padding) a ambos lados.
 * Útil porque Profit/MSSQL suele entregar códigos almacenados en CHAR(30)
 * rellenados con espacios en blanco.
 */
export const whereTrimCod = (value: string): WhereOptions =>
  where(fn('TRIM', col('cod')), String(value).trim()) as unknown as WhereOptions;
