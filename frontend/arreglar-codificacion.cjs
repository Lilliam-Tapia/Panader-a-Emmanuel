
const fs = require('fs');
const path = require('path');

const carpeta = path.join(__dirname, 'src', 'pages');

const archivos = [
  'Login.jsx',
  'Productos.jsx',
  'Inventario.jsx',
  'Ventas.jsx'
];

const cambios = [
  ['Ã¡', 'á'],
  ['Ã©', 'é'],
  ['Ã­', 'í'],
  ['Ã³', 'ó'],Ãí 
  ['Ãº', 'ú'],
  ['Ã±', 'ñ'],
  ['Ã‘', 'Ñ'],
  ['Ã¼', 'ü'],
  ['Â¡', '¡'],
  ['Â¿', '¿'],
  ['Ã—', '×'],
  ['â€”', '—'],
  ['â€“', '–'],
  ['â€¦', '…'],
  ['â€˜', '‘'],
  ['â€™', '’'],
  ['â€œ', '“'],
  ['â€', '”'],
  ['ðŸ¥–', '🥖'],
  ['ðŸ›’', '🛒'],
  ['ðŸ“¦', '📦'],
  ['ðŸ§¾', '🧾'],
  ['ðŸ', '']
  
];

for (const nombre of archivos) {
  const archivo = path.join(carpeta, nombre);

  if (!fs.existsSync(archivo)) {
    console.log(`No encontrado: ${nombre}`);
    continue;
  }

  const original = fs.readFileSync(archivo, 'utf8');

  // Copia de seguridad sin sobrescribir una copia anterior.
  const copia = archivo + '.antes-codificacion';
  if (!fs.existsSync(copia)) {
    fs.writeFileSync(copia, original, 'utf8');
  }

  let texto = original;

  for (const [incorrecto, correcto] of cambios) {
    texto = texto.replaceAll(incorrecto, correcto);
  }

  fs.writeFileSync(archivo, texto, 'utf8');
  console.log(`Revisado: ${nombre}`);
}
