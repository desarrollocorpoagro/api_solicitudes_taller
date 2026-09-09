import 'dotenv/config';
import { initProfitDatabase, profitSequelize } from '../src/backend/config/profitDb';

async function main() {
  await initProfitDatabase();
  const [views] = await profitSequelize.query(
    `SELECT TABLE_NAME FROM [AD_TRANS].[INFORMATION_SCHEMA].[VIEWS] WHERE TABLE_NAME LIKE 'vw_flota%'`
  ) as any;
  console.log('VIEWS=' + JSON.stringify((views || []).map((v: any) => v.TABLE_NAME)));

  const [tcnt] = await profitSequelize.query(
    `SELECT COUNT(*) AS c FROM [AD_TRANS].[dbo].[flota_vehiculos] WITH (NOLOCK)`
  ) as any;
  console.log('TABLA_FLOTA=' + tcnt[0].c);

  try {
    const [vcnt] = await profitSequelize.query(
      `SELECT COUNT(*) AS c FROM [AD_TRANS].[dbo].[vw_flota_vehiculos] WITH (NOLOCK)`
    ) as any;
    console.log('VISTA_FLOTA=' + vcnt[0].c);
    for (const p of ['A12BC3D', 'A06DCOM']) {
      const [r] = await profitSequelize.query(
        `SELECT Placa, Marca FROM [AD_TRANS].[dbo].[vw_flota_vehiculos] WITH (NOLOCK) WHERE LTRIM(RTRIM(Placa)) = ?`,
        { replacements: [p] }
      ) as any;
      console.log(`VISTA ${p}=` + (r && r[0] ? JSON.stringify(r[0]) : 'NO_ENCONTRADO'));
    }
  } catch (e: any) {
    console.log('VISTA_ERR=' + e.message);
  }
  await profitSequelize.close();
}

main().catch((e) => { console.error('FATAL ' + e.message); process.exit(1); });