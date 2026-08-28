import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface DatabaseConnectionAttributes {
  id: string;
  nombre: string;
  host: string;
  port: number;
  databaseName: string;
  username: string;
  password?: string;
  dialect: string; // 'mssql' | 'sqlite' | 'postgres'
  trustServerCertificate: boolean;
  encrypt?: boolean;
  options?: any;
  isDefault: boolean;
  isActive: boolean;
  status: string; // 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'FALLBACK_SQLITE'
  lastTestedAt?: Date;
  lastError?: string;
  latencyMs?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DatabaseConnectionCreationAttributes
  extends Optional<DatabaseConnectionAttributes, 'id' | 'isDefault' | 'isActive' | 'status' | 'trustServerCertificate'> {}

export class DatabaseConnection
  extends Model<DatabaseConnectionAttributes, DatabaseConnectionCreationAttributes>
  implements DatabaseConnectionAttributes
{
  public id!: string;
  public nombre!: string;
  public host!: string;
  public port!: number;
  public databaseName!: string;
  public username!: string;
  public password?: string;
  public dialect!: string;
  public trustServerCertificate!: boolean;
  public encrypt?: boolean;
  public options?: any;
  public isDefault!: boolean;
  public isActive!: boolean;
  public status!: string;
  public lastTestedAt?: Date;
  public lastError?: string;
  public latencyMs?: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

DatabaseConnection.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    nombre: {
      type: DataTypes.STRING(150),
      allowNull: false,
      defaultValue: 'Servidor Profit Plus (AD_TRANS)',
    },
    host: {
      type: DataTypes.STRING(150),
      allowNull: false,
      defaultValue: 'SRVBDPROFITBK',
    },
    port: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1433,
    },
    databaseName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'AD_TRANS',
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'solicitudweb',
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: 'solicitudweb',
    },
    dialect: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'mssql',
    },
    trustServerCertificate: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    encrypt: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    options: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {
        connectTimeout: 5000,
        requestTimeout: 15000,
        pool: { max: 10, min: 0 },
      },
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'DISCONNECTED',
    },
    lastTestedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastError: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    latencyMs: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'database_connections',
    timestamps: true,
  }
);

export default DatabaseConnection;
