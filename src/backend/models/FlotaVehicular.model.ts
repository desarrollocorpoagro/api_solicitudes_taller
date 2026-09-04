import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface FlotaVehicularAttributes {
  id: string;
  companyId?: string;
  codigo?: string | null;
  placa: string;
  placa_anterior?: string | null;
  marca: string;
  modelo?: string | null;
  anio?: number | null;
  color?: string | null;
  clase?: string | null;
  tipo: string;
  empresa: string;
  Empresa_Propietaria?: string | null;
  cc?: string | null;
  fec_adquisicion?: Date | string | null;
  carga_max_kg?: number | null;
  carga_max_lts?: number | null;
  serial_carroceria1?: string | null;
  serial_carroceria2?: string | null;
  Serial_Motor?: string | null;
  Uso?: string | null;
  Estatus_operatividad?: string | null;
  Observaciones?: string | null;
  cant_cauchos_vehiculo?: number | null;
  medida_caucho_vehiculo?: string | null;
  km?: number;
  km_actual?: number | null;
  tipo_bateria1?: string | null;
  serial_bateria1?: string | null;
  fec_garantia_bateria1?: Date | string | null;
  tipo_bateria2?: string | null;
  serial_bateria2?: string | null;
  fec_garantia_bateria2?: Date | string | null;
  contrato_seguro?: string | null;
  empresa_seguro?: string | null;
  fec_venc_seguro?: Date | string | null;
  fec_venc_trimestres?: Date | string | null;
  nro_ROTC?: string | null;
  fec_venc_ROTC?: Date | string | null;
  nro_RACDA?: string | null;
  fec_venc_RACDA?: Date | string | null;
  nro_gps1?: string | null;
  nro_gps2?: string | null;
  nro_ejes?: number | null;
  calibracion?: string | null;
  venc_calibrac?: Date | string | null;
  tara?: number | null;
  funcion?: string | null;
  division?: string | null;
  activo?: boolean | number | string | null;
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
  public codigo!: string | null;
  public placa!: string;
  public placa_anterior!: string | null;
  public marca!: string;
  public modelo!: string | null;
  public anio!: number | null;
  public color!: string | null;
  public clase!: string | null;
  public tipo!: string;
  public empresa!: string;
  public Empresa_Propietaria!: string | null;
  public cc!: string | null;
  public fec_adquisicion!: Date | string | null;
  public carga_max_kg!: number | null;
  public carga_max_lts!: number | null;
  public serial_carroceria1!: string | null;
  public serial_carroceria2!: string | null;
  public Serial_Motor!: string | null;
  public Uso!: string | null;
  public Estatus_operatividad!: string | null;
  public Observaciones!: string | null;
  public cant_cauchos_vehiculo!: number | null;
  public medida_caucho_vehiculo!: string | null;
  public km!: number;
  public km_actual!: number | null;
  public tipo_bateria1!: string | null;
  public serial_bateria1!: string | null;
  public fec_garantia_bateria1!: Date | string | null;
  public tipo_bateria2!: string | null;
  public serial_bateria2!: string | null;
  public fec_garantia_bateria2!: Date | string | null;
  public contrato_seguro!: string | null;
  public empresa_seguro!: string | null;
  public fec_venc_seguro!: Date | string | null;
  public fec_venc_trimestres!: Date | string | null;
  public nro_ROTC!: string | null;
  public fec_venc_ROTC!: Date | string | null;
  public nro_RACDA!: string | null;
  public fec_venc_RACDA!: Date | string | null;
  public nro_gps1!: string | null;
  public nro_gps2!: string | null;
  public nro_ejes!: number | null;
  public calibracion!: string | null;
  public venc_calibrac!: Date | string | null;
  public tara!: number | null;
  public funcion!: string | null;
  public division!: string | null;
  public activo!: boolean | number | string | null;
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
    codigo: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    placa: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    placa_anterior: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    marca: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: 'Sin datos',
    },
    modelo: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    anio: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    color: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    clase: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    tipo: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    empresa: {
      type: DataTypes.STRING(150),
      allowNull: true,
      defaultValue: 'Sin empresa',
    },
    Empresa_Propietaria: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    cc: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    fec_adquisicion: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    carga_max_kg: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    carga_max_lts: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    serial_carroceria1: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    serial_carroceria2: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    Serial_Motor: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    Uso: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    Estatus_operatividad: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    Observaciones: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cant_cauchos_vehiculo: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    medida_caucho_vehiculo: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    km: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    km_actual: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    tipo_bateria1: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    serial_bateria1: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    fec_garantia_bateria1: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    tipo_bateria2: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    serial_bateria2: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    fec_garantia_bateria2: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    contrato_seguro: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    empresa_seguro: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    fec_venc_seguro: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    fec_venc_trimestres: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    nro_ROTC: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    fec_venc_ROTC: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    nro_RACDA: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    fec_venc_RACDA: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    nro_gps1: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    nro_gps2: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    nro_ejes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    calibracion: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    venc_calibrac: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    tara: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    funcion: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    division: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true,
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
