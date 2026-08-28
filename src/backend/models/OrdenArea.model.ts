import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export const TARIFAS_AREA: Record<string, number> = {
  'Mtto preventivo': 12,
  'Reparaciones mayores': 18,
  'Mtto correctivo': 15,
  'Metalmecánica': 20,
  'Latonería y pintura': 16,
  'Cauchera': 10,
  'Lavado': 7,
};

export interface OrdenAreaAttributes {
  id: string; // e.g. OT-A1
  ordenId: string;
  area: string;
  fechaRecepcion: Date;
  mecanico: string;
  diagnostico: string;
  horas: number;
  tarifaHora: number;
  costoManoObra: number;
  estado: 'abierta' | 'cerrada';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrdenAreaCreationAttributes extends Optional<OrdenAreaAttributes, 'id' | 'horas' | 'tarifaHora' | 'costoManoObra' | 'estado'> {}

export class OrdenArea extends Model<OrdenAreaAttributes, OrdenAreaCreationAttributes> implements OrdenAreaAttributes {
  public id!: string;
  public ordenId!: string;
  public area!: string;
  public fechaRecepcion!: Date;
  public mecanico!: string;
  public diagnostico!: string;
  public horas!: number;
  public tarifaHora!: number;
  public costoManoObra!: number;
  public estado!: 'abierta' | 'cerrada';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

OrdenArea.init(
  {
    id: {
      type: DataTypes.STRING(50),
      primaryKey: true,
    },
    ordenId: {
      type: DataTypes.STRING(50),
      allowNull: false,
      references: {
        model: 'ordenes_servicio',
        key: 'id',
      },
    },
    area: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    fechaRecepcion: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    mecanico: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    diagnostico: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '',
    },
    horas: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0,
    },
    tarifaHora: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 12.00,
    },
    costoManoObra: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    estado: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'abierta',
    },
  },
  {
    sequelize,
    tableName: 'ordenes_area',
    timestamps: true,
    hooks: {
      beforeSave: (instance: OrdenArea) => {
        const tarifa = TARIFAS_AREA[instance.area] || instance.tarifaHora || 12;
        instance.tarifaHora = tarifa;
        instance.costoManoObra = parseFloat((Number(instance.horas) * tarifa).toFixed(2));
      },
    },
  }
);

export default OrdenArea;
