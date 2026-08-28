import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface OrdenServicioAttributes {
  id: string; // e.g. OS-2026-00089
  tenantId?: string;
  placa: string;
  km: number;
  recibidoPor: string;
  entregadoPor?: string;
  sintomas: string;
  fotosCount: number;
  esReincidencia: boolean;
  osAnterior?: string;
  motivoReincidencia?: string;
  estado: 'Abierta' | 'En Proceso' | 'Cerrada';
  fechaApertura: Date;
  fechaEntrega?: Date;
  recibeConforme?: string;
  totalRepuestos: number;
  totalManoObra: number;
  totalExternos: number;
  totalGeneral: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrdenServicioCreationAttributes extends Optional<OrdenServicioAttributes, 'fotosCount' | 'esReincidencia' | 'estado' | 'totalRepuestos' | 'totalManoObra' | 'totalExternos' | 'totalGeneral'> {}

export class OrdenServicio extends Model<OrdenServicioAttributes, OrdenServicioCreationAttributes> implements OrdenServicioAttributes {
  public id!: string;
  public tenantId!: string;
  public placa!: string;
  public km!: number;
  public recibidoPor!: string;
  public entregadoPor!: string;
  public sintomas!: string;
  public fotosCount!: number;
  public esReincidencia!: boolean;
  public osAnterior!: string;
  public motivoReincidencia!: string;
  public estado!: 'Abierta' | 'En Proceso' | 'Cerrada';
  public fechaApertura!: Date;
  public fechaEntrega!: Date;
  public recibeConforme!: string;
  public totalRepuestos!: number;
  public totalManoObra!: number;
  public totalExternos!: number;
  public totalGeneral!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public ordenesArea?: any[];
  public solicitudesRepuesto?: any[];
  public solicitudesExterno?: any[];
}

OrdenServicio.init(
  {
    id: {
      type: DataTypes.STRING(50),
      primaryKey: true,
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    placa: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    km: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    recibidoPor: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    entregadoPor: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    sintomas: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    fotosCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    esReincidencia: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    osAnterior: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    motivoReincidencia: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    estado: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'Abierta',
    },
    fechaApertura: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    fechaEntrega: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    recibeConforme: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    totalRepuestos: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00,
    },
    totalManoObra: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00,
    },
    totalExternos: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00,
    },
    totalGeneral: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00,
    },
  },
  {
    sequelize,
    tableName: 'ordenes_servicio',
    timestamps: true,
  }
);

export default OrdenServicio;
