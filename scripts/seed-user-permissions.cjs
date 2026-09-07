// Ejecuta la siembra de user_permissions desde los permisos del rol.
// Uso: node scripts/seed-user-permissions.cjs
require('dotenv').config();
require('tsx/cjs');

(async () => {
  try {
    const mod = require('../src/backend/models');
    const summary = await mod.seedUserPermissionsFromRoles();
    console.log('Resumen:', JSON.stringify(summary, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();