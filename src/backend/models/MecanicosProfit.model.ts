import { DataTypes, Model } from 'sequelize';
import { profitSequelize } from '../config/profitDb';

export class MecanicosProfit extends Model {
  public codigo!: string;
  public nombre!: string;
  public cargo!: string | null;
  public activo!: boolean;
}

export function initMecanicosProfitModel(seq: any) {
  MecanicosProfit.init(
    {
      codigo: {
        type: DataTypes.STRING(30),
        primaryKey: true,
        allowNull: false,
      },
      nombre: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      cargo: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      activo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        get() {
          const val = this.getDataValue('activo');
          return val === true || val === 1 || val === '1' || val === 'true';
        },
      },
    },
    {
      sequelize: seq,
      tableName: 'mecanicos',
      schema: seq.getDialect() === 'mssql' ? 'dbo' : undefined,
      timestamps: false,
    }
  );
  return MecanicosProfit;
}

initMecanicosProfitModel(profitSequelize);

export default MecanicosProfit;
