import { DataTypes, Model, Optional } from 'sequelize';
import { profitSequelize } from '../config/profitDb';

export interface VwFlotaVendedoresAttributes {
  co_ven: string;
  cedula: string;
  ven_des: string;
}

export interface VwFlotaVendedoresCreationAttributes
  extends Optional<VwFlotaVendedoresAttributes, 'cedula' | 'ven_des'> {}

export class VwFlotaVendedores
  extends Model<VwFlotaVendedoresAttributes, VwFlotaVendedoresCreationAttributes>
  implements VwFlotaVendedoresAttributes
{
  public co_ven!: string;
  public cedula!: string;
  public ven_des!: string;
}

export function initVwFlotaVendedoresModel(seq: any) {
  VwFlotaVendedores.init(
    {
      co_ven: {
        type: DataTypes.STRING(30),
        primaryKey: true,
        allowNull: false,
      },
      cedula: {
        type: DataTypes.STRING(30),
        allowNull: true,
      },
      ven_des: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
    },
    {
      sequelize: seq,
      tableName: 'vw_flota_vendedores',
      schema: seq.getDialect() === 'mssql' ? 'dbo' : undefined,
      timestamps: false,
    }
  );
  return VwFlotaVendedores;
}

initVwFlotaVendedoresModel(profitSequelize);

export default VwFlotaVendedores;
