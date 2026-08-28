import { DataTypes, Model, Optional } from 'sequelize';
import { profitSequelize } from '../config/profitDb';

export interface FlotaOrdenServicioProfitAttributes {
  id_orden?: number;
  nro_orden: string;
  Placa: string;
  km_horometro: number;
  recibido_por: string;
  entregado_por?: string | null;
  fec_apertura?: Date;
  fec_cierre?: Date | null;
  sintomas_reportados: string;
  es_reincidencia?: boolean;
  nro_orden_anterior?: string | null;
  motivo_reincidencia?: string | null;
  fotos_adjuntas?: number;
  estatus?: string;
  costo_repuestos?: number;
  costo_mano_obra?: number;
  costo_servicios_ext?: number;
  costo_total?: number;
  recibe_conforme?: string | null;
  hora_apertura?: Date | null;
  hora_cierre?: Date | null;
}

export interface FlotaOrdenServicioProfitCreationAttributes
  extends Optional<
    FlotaOrdenServicioProfitAttributes,
    | 'id_orden'
    | 'entregado_por'
    | 'fec_apertura'
    | 'fec_cierre'
    | 'es_reincidencia'
    | 'nro_orden_anterior'
    | 'motivo_reincidencia'
    | 'fotos_adjuntas'
    | 'estatus'
    | 'costo_repuestos'
    | 'costo_mano_obra'
    | 'costo_servicios_ext'
    | 'costo_total'
    | 'recibe_conforme'
    | 'hora_apertura'
    | 'hora_cierre'
  > {}

export class FlotaOrdenServicioProfit
  extends Model<FlotaOrdenServicioProfitAttributes, FlotaOrdenServicioProfitCreationAttributes>
  implements FlotaOrdenServicioProfitAttributes
{
  public id_orden!: number;
  public nro_orden!: string;
  public Placa!: string;
  public km_horometro!: number;
  public recibido_por!: string;
  public entregado_por!: string | null;
  public fec_apertura!: Date;
  public fec_cierre!: Date | null;
  public sintomas_reportados!: string;
  public es_reincidencia!: boolean;
  public nro_orden_anterior!: string | null;
  public motivo_reincidencia!: string | null;
  public fotos_adjuntas!: number;
  public estatus!: string;
  public costo_repuestos!: number;
  public costo_mano_obra!: number;
  public costo_servicios_ext!: number;
  public costo_total!: number;
  public recibe_conforme!: string | null;
  public hora_apertura!: Date | null;
  public hora_cierre!: Date | null;
}

export function initFlotaOrdenServicioProfitModel(seq: any) {
  FlotaOrdenServicioProfit.init(
    {
      id_orden: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      nro_orden: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
      },
      Placa: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      km_horometro: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        get() {
          const val = this.getDataValue('km_horometro');
          return val !== null && val !== undefined ? parseFloat(String(val)) : 0;
        },
      },
      recibido_por: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      entregado_por: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      fec_apertura: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      fec_cierre: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      sintomas_reportados: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      es_reincidencia: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      nro_orden_anterior: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      motivo_reincidencia: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      fotos_adjuntas: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      estatus: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'ABIERTA',
      },
      costo_repuestos: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.0,
        get() {
          const val = this.getDataValue('costo_repuestos');
          return val !== null && val !== undefined ? parseFloat(String(val)) : 0;
        },
      },
      costo_mano_obra: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.0,
        get() {
          const val = this.getDataValue('costo_mano_obra');
          return val !== null && val !== undefined ? parseFloat(String(val)) : 0;
        },
      },
      costo_servicios_ext: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.0,
        get() {
          const val = this.getDataValue('costo_servicios_ext');
          return val !== null && val !== undefined ? parseFloat(String(val)) : 0;
        },
      },
      costo_total: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.0,
        get() {
          const val = this.getDataValue('costo_total');
          return val !== null && val !== undefined ? parseFloat(String(val)) : 0;
        },
      },
      recibe_conforme: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      hora_apertura: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      hora_cierre: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize: seq,
      tableName: 'flota_ordenes_servicio',
      schema: seq.getDialect() === 'mssql' ? 'dbo' : undefined,
      timestamps: false,
    }
  );
  return FlotaOrdenServicioProfit;
}

initFlotaOrdenServicioProfitModel(profitSequelize);

export default FlotaOrdenServicioProfit;
