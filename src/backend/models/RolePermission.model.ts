import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface RolePermissionAttributes {
  id: string;
  role: string;
  module: string;
  actions: string[]; // ['read', 'create', 'update', 'delete', 'approve', 'dispatch', 'admin', 'execute_query']
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RolePermissionCreationAttributes
  extends Optional<RolePermissionAttributes, 'id' | 'description'> {}

export class RolePermission
  extends Model<RolePermissionAttributes, RolePermissionCreationAttributes>
  implements RolePermissionAttributes
{
  public id!: string;
  public role!: string;
  public module!: string;
  public actions!: string[];
  public description?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RolePermission.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    role: {
      type: DataTypes.STRING(50),
      allowNull: false,
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
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'role_permissions',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['role', 'module'],
      },
    ],
  }
);

export default RolePermission;
