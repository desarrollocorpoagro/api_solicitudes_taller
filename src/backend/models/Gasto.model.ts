import { DataTypes, Model, Optional } from 'sequelize';
import { Sequelize } from 'sequelize';

/**
 * Origen de un gasto. Determina la semántica y los hooks que lo generan.
 *   - AREA         → Mano de obra de una OrdenArea (horas * tarifaHora)
 *   - REPUESTO     → SolicitudRepuesto aprobada (cantidad * costoUnitario)
 *   - EXTERNO      → SolicitudExterno aprobada (costoEfectivo)
 */
export type GastoOrigen = 'AREA' | 'REPUESTO' | 'EXTERNO';

/**
 * Estado de sincronización con MSSQL. Se prefiere este flag semántico a un
 * booleano para distinguir PENDIENTE/ENVIADO/ERROR sin ambigüedades.
 */
export type GastoSyncStatus = 'PENDIENTE' | 'ENVIADO' | 'ERROR';

export interface GastoAttributes {
  id: number;
  /** Tipo de origen: AREA | REPUESTO | EXTERNO */
  tipo_origen?: GastoOrigen | null;
  /** UUID o id de la OrdenArea / SolicitudRepuesto / SolicitudExterno que originó este gasto */
  id_origen_referencia?: string | null;
  /**
   * Clave natural única para idempotencia. Formato: `${tipo_origen}:${id_origen_referencia}`.
   * Permite UPSERT en MSSQL sin duplicar filas en reconexiones.
   */
  idempotency_key?: string | null;
  codigo_articulo?: string | null;
  codigo_subalmacen?: string | null;
  co_cli?: string | null;
  co_prov?: string | null;
  fecha_actividad?: Date | null;
  cantidad?: number | null;
  unidad?: string | null;
  horas_trabajadas?: number | null;
  costo_unitario?: number | null;
  /** Monto total. Se calcula en beforeSave pero también puede fijarse manualmente. */
  monto?: number | null;
  costo_total_calculado?: number | null;
  usuario?: string | null;
  nota?: string | null;
  fecha_create?: Date | null;
  ordenId?: string | null;
  solicitudId?: string | null;
  id_ordenser?: number | null;
  placa?: string | null;
  estado_sincronizacion?: GastoSyncStatus;
  syncedToMssql?: boolean;
  intentos_sincronizacion?: number;
  mssqlSyncedAt?: Date | null;
  mssqlError?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface GastoCreationAttributes
  extends Optional<
    GastoAttributes,
    | 'id'
    | 'tipo_origen'
    | 'id_origen_referencia'
    | 'idempotency_key'
    | 'codigo_articulo'
    | 'codigo_subalmacen'
    | 'co_cli'
    | 'co_prov'
    | 'fecha_actividad'
    | 'cantidad'
    | 'unidad'
    | 'horas_trabajadas'
    | 'costo_unitario'
    | 'monto'
    | 'costo_total_calculado'
    | 'usuario'
    | 'nota'
    | 'fecha_create'
    | 'ordenId'
    | 'solicitudId'
    | 'id_ordenser'
    | 'placa'
    | 'estado_sincronizacion'
    | 'syncedToMssql'
    | 'intentos_sincronizacion'
    | 'mssqlSyncedAt'
    | 'mssqlError'
  > {}

export class Gasto
  extends Model<GastoAttributes, GastoCreationAttributes>
  implements GastoAttributes
{
  public id!: number;
  public tipo_origen!: GastoOrigen | null;
  public id_origen_referencia!: string | null;
  public idempotency_key!: string | null;
  public codigo_articulo!: string | null;
  public codigo_subalmacen!: string | null;
  public co_cli!: string | null;
  public co_prov!: string | null;
  public fecha_actividad!: Date | null;
  public cantidad!: number | null;
  public unidad!: string | null;
  public horas_trabajadas!: number | null;
  public costo_unitario!: number | null;
  public monto!: number | null;
  public costo_total_calculado!: number | null;
  public usuario!: string | null;
  public nota!: string | null;
  public fecha_create!: Date | null;
  public ordenId!: string | null;
  public solicitudId!: string | null;
  public id_ordenser!: number | null;
  public placa!: string | null;
  public estado_sincronizacion!: GastoSyncStatus;
  public syncedToMssql!: boolean;
  public intentos_sincronizacion!: number;
  public mssqlSyncedAt!: Date | null;
  public mssqlError!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  /**
   * Calcula la clave de idempotencia a partir del tipo y referencia.
   * Se usa para UPSERT idempotente en MSSQL.
   */
  public computeIdempotencyKey(): string {
    if (!this.tipo_origen || !this.id_origen_referencia) {
      // Fallback: usar la PK local + ordenId + solicitudId si están.
      return `LEGACY:${this.ordenId ?? ''}:${this.solicitudId ?? ''}:${this.codigo_articulo ?? ''}`;
    }
    return `${this.tipo_origen}:${this.id_origen_referencia}`;
  }
}

export function initGastoModel(seq: Sequelize) {
  Gasto.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      tipo_origen: {
        type: DataTypes.STRING(20),
        allowNull: true,
        validate: {
          isIn: [['AREA', 'REPUESTO', 'EXTERNO']],
        },
      },
      id_origen_referencia: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      idempotency_key: {
        type: DataTypes.STRING(120),
        allowNull: true,
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
      monto: {
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
      id_ordenser: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      placa: {
        type: DataTypes.STRING(30),
        allowNull: true,
        defaultValue: '',
      },
      estado_sincronizacion: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'PENDIENTE',
        validate: {
          isIn: [['PENDIENTE', 'ENVIADO', 'ERROR']],
        },
      },
      syncedToMssql: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      intentos_sincronizacion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
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
      indexes: [
        {
          unique: true,
          fields: ['idempotency_key'],
        },
      ],
      hooks: {
        beforeSave: (gasto: any) => {
          // Derivar idempotency_key si no se setea explícitamente
          if (!gasto.idempotency_key && gasto.tipo_origen && gasto.id_origen_referencia) {
            gasto.idempotency_key = `${gasto.tipo_origen}:${gasto.id_origen_referencia}`;
          }
          // Sincronizar flag binario con estado semántico
          if (gasto.estado_sincronizacion === 'ENVIADO') {
            gasto.syncedToMssql = true;
          } else if (gasto.estado_sincronizacion === 'PENDIENTE' || gasto.estado_sincronizacion === 'ERROR') {
            gasto.syncedToMssql = false;
          }
          // Si no hay monto explícito, derivar de costo_total_calculado
          if (gasto.monto == null || gasto.monto === 0) {
            gasto.monto = Number(gasto.costo_total_calculado ?? 0);
          }
        },
      },
    }
  );
  return Gasto;
}

export default Gasto;