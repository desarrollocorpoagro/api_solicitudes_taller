import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface NotificacionAttributes {
  id: string;
  tenantId?: string;
  userId?: string;
  destinatarioEmail?: string;
  tipo: 'EMAIL' | 'PUSH' | 'SISTEMA';
  canal: string; // orden_servicio, aprobacion, despacho, alerta, reincidencia
  titulo: string;
  mensaje: string;
  datos?: any;
  estadoEnvio: 'ENVIADO' | 'PENDIENTE' | 'FALLIDO';
  leido: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface NotificacionCreationAttributes extends Optional<NotificacionAttributes, 'id' | 'estadoEnvio' | 'leido'> {}

export class Notificacion extends Model<NotificacionAttributes, NotificacionCreationAttributes> implements NotificacionAttributes {
  public id!: string;
  public tenantId!: string;
  public userId!: string;
  public destinatarioEmail!: string;
  public tipo!: 'EMAIL' | 'PUSH' | 'SISTEMA';
  public canal!: string;
  public titulo!: string;
  public mensaje!: string;
  public datos!: any;
  public estadoEnvio!: 'ENVIADO' | 'PENDIENTE' | 'FALLIDO';
  public leido!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Notificacion.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    destinatarioEmail: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    tipo: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'EMAIL',
    },
    canal: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'orden_servicio',
    },
    titulo: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    mensaje: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    datos: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    estadoEnvio: {
      type: DataTypes.STRING(20),
      defaultValue: 'ENVIADO',
    },
    leido: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'notificaciones',
    timestamps: true,
  }
);

export default Notificacion;
