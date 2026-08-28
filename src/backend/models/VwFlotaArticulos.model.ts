import { DataTypes, Model, Optional } from 'sequelize';
import { profitSequelize } from '../config/profitDb';

export interface VwFlotaArticulosAttributes {
  codigo_profit: string;
  nombre_producto: string;
  codigo_categoria?: string | null;
  categoria?: string | null;
  unidad_medida?: string | null;
  costo: number;
  tipo?: string | null;
  codigo_subalmacen?: string | null;
  sub_almacen?: string | null;
  codigo_almacen?: string | null;
  almacen?: string | null;
  stock_act: number;
}

export interface VwFlotaArticulosCreationAttributes
  extends Optional<
    VwFlotaArticulosAttributes,
    | 'codigo_categoria'
    | 'categoria'
    | 'unidad_medida'
    | 'tipo'
    | 'codigo_subalmacen'
    | 'sub_almacen'
    | 'codigo_almacen'
    | 'almacen'
  > {}

export class VwFlotaArticulos
  extends Model<VwFlotaArticulosAttributes, VwFlotaArticulosCreationAttributes>
  implements VwFlotaArticulosAttributes
{
  public codigo_profit!: string;
  public nombre_producto!: string;
  public codigo_categoria!: string | null;
  public categoria!: string | null;
  public unidad_medida!: string | null;
  public costo!: number;
  public tipo!: string | null;
  public codigo_subalmacen!: string | null;
  public sub_almacen!: string | null;
  public codigo_almacen!: string | null;
  public almacen!: string | null;
  public stock_act!: number;
}

export function initVwFlotaArticulosModel(seq: any) {
  VwFlotaArticulos.init(
    {
      codigo_profit: {
        type: DataTypes.STRING(50),
        primaryKey: true,
        allowNull: false,
      },
      nombre_producto: {
        type: DataTypes.STRING(250),
        allowNull: false,
      },
      codigo_categoria: {
        type: DataTypes.STRING(30),
        allowNull: true,
      },
      categoria: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      unidad_medida: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      costo: {
        type: DataTypes.DECIMAL(18, 4),
        allowNull: false,
        defaultValue: 0.0,
        get() {
          const val = this.getDataValue('costo');
          return val !== null && val !== undefined ? parseFloat(String(val)) : 0;
        },
      },
      tipo: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      codigo_subalmacen: {
        type: DataTypes.STRING(30),
        allowNull: true,
      },
      sub_almacen: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      codigo_almacen: {
        type: DataTypes.STRING(30),
        allowNull: true,
      },
      almacen: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      stock_act: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.0,
        get() {
          const val = this.getDataValue('stock_act');
          return val !== null && val !== undefined ? parseFloat(String(val)) : 0;
        },
      },
    },
    {
      sequelize: seq,
      tableName: 'vw_flota_articulos',
      schema: seq.getDialect() === 'mssql' ? 'dbo' : undefined,
      timestamps: false,
    }
  );
  return VwFlotaArticulos;
}

initVwFlotaArticulosModel(profitSequelize);

export default VwFlotaArticulos;
