import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface OrdenAuditLogAttributes {
  id: string;
  ordenId: string;
  otId?: string | null;
  action: string; // APERTURA_ORDEN, MODIFICACION_CAMPO, CREACION_OT, ACTUALIZACION_OT, CIERRE_OT, SOLICITUD_REPUESTO, APROBACION_REPUESTO, RECHAZO_REPUESTO, DESPACHO_REPUESTO, SOLICITUD_EXTERNO, APROBACION_EXTERNO, SUBIDA_MULTIMEDIA, CIERRE_ORDEN
  fieldName: string; // e.g. km, sintomas, recibidoPor, entregadoPor, estado, diagnostico, horas, costoManoObra, mecanico, repuesto, general
  previousValue?: string | null;
  newValue?: string | null;
  description: string;
  userId?: string | null;
  userName: string;
  userEmail: string;
  userRole: string;
  ipAddress?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrdenAuditLogCreationAttributes extends Optional<OrdenAuditLogAttributes, 'id' | 'otId' | 'previousValue' | 'newValue' | 'userId' | 'ipAddress'> {}

export class OrdenAuditLog extends Model<OrdenAuditLogAttributes, OrdenAuditLogCreationAttributes> implements OrdenAuditLogAttributes {
  public id!: string;
  public ordenId!: string;
  public otId!: string | null;
  public action!: string;
  public fieldName!: string;
  public previousValue!: string | null;
  public newValue!: string | null;
  public description!: string;
  public userId!: string | null;
  public userName!: string;
  public userEmail!: string;
  public userRole!: string;
  public ipAddress!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

OrdenAuditLog.init(
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
      onDelete: 'CASCADE',
    },
    otId: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    action: {
      type: DataTypes.STRING(60),
      allowNull: false,
      defaultValue: 'MODIFICACION_CAMPO',
    },
    fieldName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'general',
    },
    previousValue: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    newValue: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    userName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      defaultValue: 'Sistema / Usuario Operativo',
    },
    userEmail: {
      type: DataTypes.STRING(150),
      allowNull: false,
      defaultValue: 'sistema@empresasanluis.com',
    },
    userRole: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'OPERATIVO',
    },
    ipAddress: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'ordenes_servicio_auditoria',
    timestamps: true,
    indexes: [
      {
        fields: ['ordenId'],
      },
      {
        fields: ['action'],
      },
      {
        fields: ['createdAt'],
      },
    ],
  }
);

export default OrdenAuditLog;
