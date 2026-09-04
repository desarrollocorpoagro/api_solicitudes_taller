import { DataTypes, Model, Optional } from 'sequelize';
import { Sequelize } from 'sequelize';

export interface GastoAttributes {
  id: number;
  codigo_articulo?: string | null;
  codigo_subalmacen?: string | null;
  co_cli?: string | null;
  co_prov?: string | null;
  fecha_actividad?: Date | null;
  cantidad?: number | null;
  unidad?: string | null;
  horas_trabajadas?: number | null;
  costo_unitario?: number | null;
  costo_total_calculado?: number | null;
  usuario?: string | null;
  nota?: string | null;
  fecha_create?: Date | null;
  ordenId?: string | null;
  solicitudId?: string | null;
  placa?: string | null;
  syncedToMssql?: boolean;
  mssqlSyncedAt?: Date | null;
  mssqlError?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface GastoCreationAttributes
  extends Optional<
    GastoAttributes,
    | 'id'
    | 'codigo_articulo'
    | 'codigo_subalmacen'
    | 'co_cli'
    | 'co_prov'
    | 'fecha_actividad'
    | 'cantidad'
    | 'unidad'
    | 'horas_trabajadas'
    | 'costo_unitario'
    | 'costo_total_calculado'
    | 'usuario'
    | 'nota'
    | 'fecha_create'
    | 'ordenId'
    | 'solicitudId'
    | 'placa'
    | 'syncedToMssql'
    | 'mssqlSyncedAt'
    | 'mssqlError'
  > {}

export class Gasto
  extends Model<GastoAttributes, GastoCreationAttributes>
  implements GastoAttributes
{
  public id!: number;
  public codigo_articulo!: string | null;
  public codigo_subalmacen!: string | null;
  public co_cli!: string | null;
  public co_prov!: string | null;
  public fecha_actividad!: Date | null;
  public cantidad!: number | null;
  public unidad!: string | null;
  public horas_trabajadas!: number | null;
  public costo_unitario!: number | null;
  public costo_total_calculado!: number | null;
  public usuario!: string | null;
  public nota!: string | null;
  public fecha_create!: Date | null;
  public ordenId!: string | null;
  public solicitudId!: string | null;
  public placa!: string | null;
  public syncedToMssql!: boolean;
  public mssqlSyncedAt!: Date | null;
  public mssqlError!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export function initGastoModel(seq: Sequelize) {
  Gasto.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      codigo_articulo: {
        type: DataTypes.STRING(30),
        allowNull: true,
      },
      codigo_subalmacen: {
        type: DataTypes.STRING(30),
        allowNull: true,
      },
      co_cli: {
        type: DataTypes.STRING(30),
        allowNull: true,
      },
      co_prov: {
        type: DataTypes.STRING(30),
        allowNull: true,
        defaultValue: 'GEN',
      },
      fecha_actividad: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: () => new Date(),
      },
      cantidad: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: 0,
      },
      unidad: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      horas_trabajadas: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: 0,
      },
      costo_unitario: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: 0,
      },
      costo_total_calculado: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: 0,
      },
      usuario: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: '',
      },
      nota: {
        type: DataTypes.STRING(500),
        allowNull: true,
        defaultValue: '',
      },
      fecha_create: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: () => new Date(),
      },
      ordenId: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      solicitudId: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      placa: {
        type: DataTypes.STRING(30),
        allowNull: true,
        defaultValue: '',
      },
      syncedToMssql: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      mssqlSyncedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      mssqlError: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
    },
    {
      sequelize: seq,
      tableName: 'gastos',
      timestamps: true,
    }
  );
  return Gasto;
}

export default Gasto;
