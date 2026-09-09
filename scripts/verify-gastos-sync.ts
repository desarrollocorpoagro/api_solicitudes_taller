import 'dotenv/config';
import { initDatabase } from '../src/backend/config/database';
import { profitSequelize } from '../src/backend/config/profitDb';

async function main() {
  await initDatabase();
  const [mssqlRows]: any = await profitSequelize.query(`SELECT idempotency_key, id_origen_referencia, codigo_articulo, id_ordenser, nro_orden, costo_total_calculado, fecha_create FROM [dbo].[gastos]`);
  console.log('MSSQL_ROWS=' + JSON.stringify(mssqlRows ?? []));
}

main().catch((e) => { console.log('FATAL ' + e.message); process.exit(1); });