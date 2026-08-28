import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface SolicitudExternoAttributes {
  id: string;
  ordenId: string;
  otId: string;
  proveedor: string;
  descripcion: string;
  conGarantia: boolean;
  ordenOrigenGarantia?: string;
  costoCotizado: number;
  costoEfectivo: number;
  estadoAprobacion: 'Pendiente' | 'Aprobada' | 'Rechazada';
  aprobadoPor?: string;
  fechaAprobacion?: Date;
  requiereEscalamiento: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SolicitudExternoCreationAttributes extends Optional<SolicitudExternoAttributes, 'id' | 'costoEfectivo' | 'estadoAprobacion' | 'requiereEscalamiento'> {}

export class SolicitudExterno extends Model<SolicitudExternoAttributes, SolicitudExternoCreationAttributes> implements SolicitudExternoAttributes {
  public id!: string;
  public ordenId!: string;
  public otId!: string;
  public proveedor!: string;
  public descripcion!: string;
  public conGarantia!: boolean;
  public ordenOrigenGarantia!: string;
  public costoCotizado!: number;
  public costoEfectivo!: number;
  public estadoAprobacion!: 'Pendiente' | 'Aprobada' | 'Rechazada';
  public aprobadoPor!: string;
  public fechaAprobacion!: Date;
  public requiereEscalamiento!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SolicitudExterno.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
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
    otId: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    proveedor: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    conGarantia: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    ordenOrigenGarantia: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    costoCotizado: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    costoEfectivo: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    estadoAprobacion: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'Pendiente',
    },
    aprobadoPor: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    fechaAprobacion: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    requiereEscalamiento: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'solicitudes_externos',
    timestamps: true,
    hooks: {
      beforeSave: (instance: SolicitudExterno) => {
        instance.costoEfectivo = instance.conGarantia ? 0.00 : parseFloat(Number(instance.costoCotizado).toFixed(2));
        instance.requiereEscalamiento = instance.costoEfectivo > 500;
      },
    },
  }
);

export default SolicitudExterno;
