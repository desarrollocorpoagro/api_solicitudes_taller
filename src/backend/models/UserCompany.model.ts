import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import User from './User.model';
import Company from './Company.model';

export interface PermissionItem {
  module: string; // fleet, taller, inventory, users, reports, approvals
  actions: string[]; // ['read', 'create', 'update', 'delete', 'approve', 'dispatch']
}

export interface UserCompanyAttributes {
  id: string;
  userId: string;
  companyId: string;
  role: string;
  permissions: PermissionItem[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserCompanyCreationAttributes extends Optional<UserCompanyAttributes, 'id' | 'role' | 'permissions'> {}

export class UserCompany extends Model<UserCompanyAttributes, UserCompanyCreationAttributes> implements UserCompanyAttributes {
  public id!: string;
  public userId!: string;
  public companyId!: string;
  public role!: string;
  public permissions!: PermissionItem[];
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public user?: User;
  public company?: Company;
}

UserCompany.init(
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
    },
    companyId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'companies',
        key: 'id',
      },
    },
    role: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'OPERADOR',
    },
    permissions: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [
        { module: 'taller', actions: ['read', 'create', 'update'] },
        { module: 'fleet', actions: ['read'] },
      ],
    },
  },
  {
    sequelize,
    tableName: 'user_companies',
    timestamps: true,
  }
);

export default UserCompany;
