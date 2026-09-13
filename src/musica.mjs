// musica.mjs — el soundtrack (un bucle) con volumen que sigue al estado del
// juego: más presente en el frenesí, discreto en el menú, casi nada al morir.
// Nada suena hasta el primer gesto del jugador (política de autoplay); M lo
// silencia junto con los efectos. El volumen se acerca al objetivo en cada tick
// del juego, sin temporizadores propios.

let audio = null;
let objetivo = 0.35;
let actual = 0;
let silenciado = false;
let activado = false;

export function cargar(url) {
  try {
    audio = new Audio(url);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
  } catch (e) { audio = null; }
}

// Llamar en el primer keydown/click.
export function activar() {
  if (!audio || activado) return;
  activado = true;
  const p = audio.play();
  if (p && p.catch) p.catch(() => { activado = false; });
}

export function nivel(v) { objetivo = v; }

export function silenciar(valor) { silenciado = !!valor; }

export function tick(dt) {
  if (!audio) return;
  const meta = silenciado ? 0 : objetivo;
  actual += (meta - actual) * Math.min(1, dt * 2.5);
  const v = Math.max(0, Math.min(1, actual));
  if (Math.abs(audio.volume - v) > 0.002) audio.volume = v;
}

export function pausar() { if (audio) audio.pause(); }

export function reanudar() {
  if (audio && activado) { const p = audio.play(); if (p && p.catch) p.catch(() => {}); }
}

// Para comprobar desde fuera que suena (arnés, consola): no lo usa el juego.
export function estado() {
  if (!audio) return { cargada: false };
  return { cargada: true, activado, pausado: audio.paused, segundos: +audio.currentTime.toFixed(1), volumen: +audio.volume.toFixed(2), listo: audio.readyState, bucle: audio.loop, src: audio.currentSrc.split('/').pop() };
}

export function cerrar() {
  if (audio) { try { audio.pause(); audio.src = ''; } catch (e) { /* nada */ } }
  audio = null; activado = false; actual = 0;
}
