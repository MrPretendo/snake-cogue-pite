// ranking.mjs — tabla de puntuaciones en Supabase (plan gratuito), vía su API
// REST. La clave que va aquí es la PÚBLICA (publishable): está pensada para
// verse; lo que puede hacer cada visitante lo deciden las reglas de la tabla
// en el servidor (insertar una fila válida y leer el top, nada más).
// Sin red, o desde un anfitrión que bloquee fetch, todo falla en silencio y el
// juego sigue igual: el ranking es un extra, no una dependencia.

let cfg = null;
const CLAVE_NOMBRE = 'scp_nombre_ranking';

export function configurar({ url, clave, tabla = 'puntuaciones' }) {
  cfg = { url: url.replace(/\/$/, ''), clave, tabla };
}

export function disponible() { return !!cfg; }

function cabeceras(extra = {}) {
  return { apikey: cfg.clave, Authorization: 'Bearer ' + cfg.clave, 'Content-Type': 'application/json', ...extra };
}

export function limpiarNombre(s) {
  return String(s || '').replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().slice(0, 12);
}

export function nombreGuardado() {
  try { return localStorage.getItem(CLAVE_NOMBRE) || ''; } catch (e) { return ''; }
}

export function guardarNombre(n) {
  try { localStorage.setItem(CLAVE_NOMBRE, n); } catch (e) { /* sin almacenamiento */ }
}

// Top N ordenado por puntos. Devuelve [] si no hay conexión.
export async function top(n = 10) {
  if (!cfg) return [];
  const q = `${cfg.url}/rest/v1/${cfg.tabla}?select=nombre,puntos,cola,tiempo,mecanica,creado&order=puntos.desc,creado.asc&limit=${n}`;
  const r = await fetch(q, { headers: cabeceras() });
  if (!r.ok) throw new Error('ranking ' + r.status);
  return r.json();
}

// Envía una puntuación. Lanza si el servidor la rechaza.
export async function enviar({ nombre, puntos, cola, tiempo, mecanica }) {
  if (!cfg) throw new Error('sin ranking');
  const fila = { nombre: limpiarNombre(nombre), puntos: Math.round(puntos), cola: Math.round(cola), tiempo: Math.round(tiempo), mecanica: String(mecanica || '').slice(0, 60) };
  if (!fila.nombre) throw new Error('nombre vacío');
  const r = await fetch(`${cfg.url}/rest/v1/${cfg.tabla}`, { method: 'POST', headers: cabeceras({ Prefer: 'return=minimal' }), body: JSON.stringify(fila) });
  if (!r.ok) throw new Error('ranking ' + r.status);
  guardarNombre(fila.nombre);
  return fila;
}
