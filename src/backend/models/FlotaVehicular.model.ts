import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface FlotaVehicularAttributes {
  id: string;
  companyId?: string;
  placa: string;
  marca: string;
  anio: number;
  tipo: string;
  empresa: string;
  cc: string; // Centro de costo
  km: number;
  qrCode?: string;
  historialOsAnterior?: string;
  historialDias?: number;
  historialArea?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FlotaVehicularCreationAttributes extends Optional<FlotaVehicularAttributes, 'id' | 'companyId'> {}

export class FlotaVehicular extends Model<FlotaVehicularAttributes, FlotaVehicularCreationAttributes> implements FlotaVehicularAttributes {
  public id!: string;
  public companyId!: string;
  public placa!: string;
  public marca!: string;
  public anio!: number;
  public tipo!: string;
  public empresa!: string;
  public cc!: string;
  public km!: number;
  public qrCode!: string;
  public historialOsAnterior!: string;
  public historialDias!: number;
  public historialArea!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

FlotaVehicular.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    companyId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    placa: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    marca: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    anio: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tipo: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    empresa: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    cc: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    km: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    qrCode: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    historialOsAnterior: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    historialDias: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    historialArea: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'flota_vehicular',
    timestamps: true,
  }
);

export default FlotaVehicular;
