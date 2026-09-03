// scripts/find-broken-string.cjs
const fs = require('fs');
const path = require('path');
const FILE = 'src/backend/models/index.ts';
const buf = fs.readFileSync(FILE);
const lines = buf.toString('utf8').split('\n');
for (let i = 80; i < 200; i++) {
  const line = lines[i];
  if (!line) continue;
  let count = 0;
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '\\') { j++; continue; }
    if (line[j] === "'") count++;
  }
  if (count % 2 !== 0) {
    console.log('Línea ' + (i + 1) + ' tiene ' + count + " comillas simples (impar):");
    console.log('  ' + line);
  }
}
console.log('Búsqueda terminada');