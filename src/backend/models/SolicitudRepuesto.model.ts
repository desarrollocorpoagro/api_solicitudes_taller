import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface SolicitudRepuestoAttributes {
  id: string;
  ordenId: string;
  otId: string;
  cod: string;
  desc: string;
  cant: number;
  costoUnitario: number;
  costoTotal: number;
  stockActual: number;
  motivo?: string;
  estadoAprobacion: 'Pendiente' | 'Aprobada' | 'Rechazada';
  estadoEntrega: 'Por entregar' | 'Entregado' | 'Backorder';
  almacen: string;
  numMovimientoERP?: string;
  numRequisicionERP?: string;
  aprobadoPor?: string;
  fechaAprobacion?: Date;
  despachadoPor?: string;
  fechaDespacho?: Date;
  requiereEscalamiento: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SolicitudRepuestoCreationAttributes extends Optional<SolicitudRepuestoAttributes, 'id' | 'costoTotal' | 'estadoAprobacion' | 'estadoEntrega' | 'almacen' | 'requiereEscalamiento'> {}

export class SolicitudRepuesto extends Model<SolicitudRepuestoAttributes, SolicitudRepuestoCreationAttributes> implements SolicitudRepuestoAttributes {
  public id!: string;
  public ordenId!: string;
  public otId!: string;
  public cod!: string;
  public desc!: string;
  public cant!: number;
  public costoUnitario!: number;
  public costoTotal!: number;
  public stockActual!: number;
  public motivo!: string;
  public estadoAprobacion!: 'Pendiente' | 'Aprobada' | 'Rechazada';
  public estadoEntrega!: 'Por entregar' | 'Entregado' | 'Backorder';
  public almacen!: string;
  public numMovimientoERP!: string;
  public numRequisicionERP!: string;
  public aprobadoPor!: string;
  public fechaAprobacion!: Date;
  public despachadoPor!: string;
  public fechaDespacho!: Date;
  public requiereEscalamiento!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SolicitudRepuesto.init(
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
    cod: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    desc: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    cant: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    costoUnitario: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    costoTotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    stockActual: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    motivo: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    estadoAprobacion: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'Pendiente',
    },
    estadoEntrega: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'Por entregar',
    },
    almacen: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'TLL-01',
    },
    numMovimientoERP: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    numRequisicionERP: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    aprobadoPor: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    fechaAprobacion: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    despachadoPor: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    fechaDespacho: {
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
    tableName: 'solicitudes_repuestos',
    timestamps: true,
    hooks: {
      beforeSave: (instance: SolicitudRepuesto) => {
        instance.costoTotal = parseFloat((Number(instance.cant) * Number(instance.costoUnitario)).toFixed(2));
        instance.requiereEscalamiento = instance.costoTotal > 500;
      },
    },
  }
);

export default SolicitudRepuesto;
