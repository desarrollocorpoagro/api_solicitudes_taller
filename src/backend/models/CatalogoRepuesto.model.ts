import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface CatalogoRepuestoAttributes {
  id: string;
  cod: string;
  desc: string;
  stock: number;
  costo: number;
  almacen: string;
  categoria?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CatalogoRepuestoCreationAttributes extends Optional<CatalogoRepuestoAttributes, 'id' | 'almacen'> {}

export class CatalogoRepuesto extends Model<CatalogoRepuestoAttributes, CatalogoRepuestoCreationAttributes> implements CatalogoRepuestoAttributes {
  public id!: string;
  public cod!: string;
  public desc!: string;
  public stock!: number;
  public costo!: number;
  public almacen!: string;
  public categoria!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CatalogoRepuesto.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    cod: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    desc: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    costo: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    almacen: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'TLL-01',
    },
    categoria: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'catalogo_repuestos',
    timestamps: true,
  }
);

export default CatalogoRepuesto;
