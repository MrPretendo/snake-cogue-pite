// tools/package.js — empaqueta Snake Cogue Pite en un ZIP listo para itch.io.
// El ZIP contendrá index.html en la raíz, host/ y src/.
//   Uso: node tools/package.js [salida.zip]

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const SALIDA = path.resolve(process.argv[2] || path.join(RAIZ, 'snake-cogue-pite.zip'));

const ARCHIVOS_BASE = [
  'index.html',
  'host/boot.mjs',
  'host/os-shim.mjs',
  'host/shell.css'
];

function listarSrc(dir) {
  const entradas = fs.readdirSync(dir, { withFileTypes: true });
  const res = [];
  for (const ent of entradas) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) res.push(...listarSrc(full));
    else res.push(path.relative(RAIZ, full).replace(/\\/g, '/'));
  }
  return res;
}

const todos = ARCHIVOS_BASE.concat(listarSrc(path.join(RAIZ, 'src')));

console.log(`Empaquetando ${todos.length} archivos para itch.io...`);

const pyScript = [
  'import zipfile, sys',
  'zip_path = sys.argv[1]',
  'files = sys.argv[2:]',
  'with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:',
  '    for f in files:',
  '        zf.write(f, f)',
  'print(f"OK:{len(files)}")'
].join('\n');

let exito = false;
const resPy = spawnSync('python', ['-c', pyScript, SALIDA, ...todos], { cwd: RAIZ });
if (resPy.status === 0 && resPy.stdout && resPy.stdout.toString().includes('OK')) {
  exito = true;
} else {
  // Fallback con PowerShell
  const psCmd = `Compress-Archive -Path ${todos.map(f => "'" + f + "'").join(',')} -DestinationPath '${SALIDA}' -Force`;
  const resPs = spawnSync('powershell', ['-NoProfile', '-Command', psCmd], { cwd: RAIZ });
  if (resPs.status === 0) exito = true;
}

if (exito && fs.existsSync(SALIDA)) {
  const stat = fs.statSync(SALIDA);
  const mb = (stat.size / (1024 * 1024)).toFixed(2);
  console.log(`\nPaquete creado con éxito:`);
  console.log(`  Archivo: ${SALIDA}`);
  console.log(`  Tamaño:  ${mb} MB (${stat.size} bytes)`);
  console.log(`\nEstructura en la raíz del ZIP:`);
  for (const f of todos) {
    console.log(`  - ${f}`);
  }
  console.log(`\n¡Listo para subir a itch.io!`);
} else {
  console.error(`Error al empaquetar.`);
  if (resPy.stderr) console.error(resPy.stderr.toString());
  process.exit(1);
}
