import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import { sequelize } from '../config/database';

export interface SyncQueueAttributes {
  id: string;
  entityType: 'ORDEN_SERVICIO' | 'ORDEN_AREA' | 'SOLICITUD_REPUESTO' | 'SOLICITUD_EXTERNO' | 'MAESTRO_FLOTA' | 'CATALOGO_REPUESTO';
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
  payload: string; // JSON serializado de la entidad
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  retryCount: number;
  maxRetries: number;
  lastError?: string | null;
  lastAttemptAt?: Date | null;
  syncedAt?: Date | null;
  source: string; // 'OFFLINE_CLIENT' | 'LOCAL_NODE' | 'TALLER_DESK'
  companyId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type SyncQueueCreationAttributes = Optional<
  SyncQueueAttributes,
  'id' | 'status' | 'retryCount' | 'maxRetries' | 'lastError' | 'lastAttemptAt' | 'syncedAt' | 'source' | 'companyId' | 'createdAt' | 'updatedAt'
>;

export class SyncQueue extends Model<SyncQueueAttributes, SyncQueueCreationAttributes> implements SyncQueueAttributes {
  public id!: string;
  public entityType!: 'ORDEN_SERVICIO' | 'ORDEN_AREA' | 'SOLICITUD_REPUESTO' | 'SOLICITUD_EXTERNO' | 'MAESTRO_FLOTA' | 'CATALOGO_REPUESTO';
  public entityId!: string;
  public operation!: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
  public payload!: string;
  public status!: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  public retryCount!: number;
  public maxRetries!: number;
  public lastError!: string | null;
  public lastAttemptAt!: Date | null;
  public syncedAt!: Date | null;
  public source!: string;
  public companyId!: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SyncQueue.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    entityType: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    entityId: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    operation: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'CREATE',
    },
    payload: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    retryCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    maxRetries: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
    },
    lastError: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    lastAttemptAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    syncedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    source: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'LOCAL_NODE',
    },
    companyId: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'offline_sync_queue',
    timestamps: true,
    indexes: [
      { fields: ['status'] },
      { fields: ['entityType', 'entityId'] },
      { fields: ['createdAt'] },
    ],
  }
);

export function initSyncQueueModel(targetSequelize: Sequelize): typeof SyncQueue {
  SyncQueue.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      entityType: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      entityId: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      operation: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: 'CREATE',
      },
      payload: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      retryCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      maxRetries: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5,
      },
      lastError: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      lastAttemptAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      syncedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      source: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'LOCAL_NODE',
      },
      companyId: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
    },
    {
      sequelize: targetSequelize,
      tableName: 'offline_sync_queue',
      timestamps: true,
      indexes: [
        { fields: ['status'] },
        { fields: ['entityType', 'entityId'] },
        { fields: ['createdAt'] },
      ],
    }
  );
  return SyncQueue;
}

export default SyncQueue;

