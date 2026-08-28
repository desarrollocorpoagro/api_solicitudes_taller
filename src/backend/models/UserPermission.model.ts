import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import User from './User.model';

export interface UserPermissionAttributes {
  id: string;
  userId: string;
  module: string;
  actions: string[]; // ['read', 'create', 'update', 'delete', 'approve', 'dispatch', 'admin', 'execute_query']
  isGranted: boolean;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserPermissionCreationAttributes
  extends Optional<UserPermissionAttributes, 'id' | 'isGranted' | 'notes'> {}

export class UserPermission
  extends Model<UserPermissionAttributes, UserPermissionCreationAttributes>
  implements UserPermissionAttributes
{
  public id!: string;
  public userId!: string;
  public module!: string;
  public actions!: string[];
  public isGranted!: boolean;
  public notes?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public user?: User;
}

UserPermission.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    module: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    actions: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: ['read'],
    },
    isGranted: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    notes: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'user_permissions',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['userId', 'module'],
      },
    ],
  }
);

export default UserPermission;
