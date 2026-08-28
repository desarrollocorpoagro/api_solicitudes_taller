import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface MultimediaAttributes {
  id: string;
  ordenId?: string;
  tipo: 'foto_sintoma' | 'foto_diagnostico' | 'comprobante_garantia' | 'inspeccion' | 'avatar';
  url: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  storageDriver: 'local' | 's3' | 'gcs';
  bucket?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MultimediaCreationAttributes extends Optional<MultimediaAttributes, 'id' | 'storageDriver'> {}

export class Multimedia extends Model<MultimediaAttributes, MultimediaCreationAttributes> implements MultimediaAttributes {
  public id!: string;
  public ordenId!: string;
  public tipo!: 'foto_sintoma' | 'foto_diagnostico' | 'comprobante_garantia' | 'inspeccion' | 'avatar';
  public url!: string;
  public filename!: string;
  public originalName!: string;
  public mimetype!: string;
  public size!: number;
  public storageDriver!: 'local' | 's3' | 'gcs';
  public bucket!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Multimedia.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ordenId: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    tipo: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'foto_sintoma',
    },
    url: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    filename: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    originalName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    mimetype: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    storageDriver: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'local',
    },
    bucket: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'multimedia',
    timestamps: true,
  }
);

export default Multimedia;
