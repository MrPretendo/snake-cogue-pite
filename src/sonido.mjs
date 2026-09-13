// sonido.mjs — efectos de sonido sintetizados con Web Audio. Sin muestras, sin
// archivos: cada efecto es una receta de osciladores, ruido y envolventes, así
// que pesa cero y se afina tocando números. Regla de la casa: ningún
// temporizador sin control (todo se programa en el reloj del AudioContext) y
// nada suena hasta el primer gesto del jugador (política de autoplay).

let ctx = null;
let master = null;
let silenciado = false;
let ruidoBuffer = null;

const VOLUMEN = 0.42;

function asegurar() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = silenciado ? 0 : VOLUMEN;
  master.connect(ctx.destination);
  // Ruido blanco de 1 s, reutilizado por todos los efectos que lo usan
  ruidoBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = ruidoBuffer.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

// Llamar en el primer keydown/click: desbloquea el audio.
export function activar() {
  const c = asegurar();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

export function silenciar(valor = !silenciado) {
  silenciado = valor;
  if (master) master.gain.setTargetAtTime(silenciado ? 0 : VOLUMEN, ctx.currentTime, 0.01);
  return silenciado;
}

export function estaSilenciado() { return silenciado; }

export function cerrar() {
  if (ctx) { try { ctx.close(); } catch (e) { /* ya cerrado */ } }
  ctx = null; master = null; ruidoBuffer = null;
}

// ---- primitivas ---------------------------------------------------------------

// Un tono con envolvente ADSR simplificada. freqFin permite barridos.
function tono({ tipo = 'sine', freq = 440, freqFin = null, t0 = 0, dur = 0.15, gain = 0.3, ataque = 0.005, caida = null, desafinar = 0 }) {
  const c = asegurar(); if (!c) return;
  const inicio = c.currentTime + t0;
  const o = c.createOscillator();
  o.type = tipo;
  o.frequency.setValueAtTime(freq, inicio);
  if (freqFin !== null) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqFin), inicio + dur);
  if (desafinar) o.detune.value = desafinar;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, inicio);
  g.gain.exponentialRampToValueAtTime(gain, inicio + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, inicio + (caida || dur));
  o.connect(g); g.connect(master);
  o.start(inicio); o.stop(inicio + (caida || dur) + 0.02);
}

// Ráfaga de ruido filtrado: golpes, whooshes, chisporroteos.
function ruido({ t0 = 0, dur = 0.2, gain = 0.2, filtro = 'bandpass', freq = 1200, freqFin = null, q = 0.8 }) {
  const c = asegurar(); if (!c) return;
  const inicio = c.currentTime + t0;
  const s = c.createBufferSource();
  s.buffer = ruidoBuffer;
  const f = c.createBiquadFilter();
  f.type = filtro; f.frequency.setValueAtTime(freq, inicio); f.Q.value = q;
  if (freqFin !== null) f.frequency.exponentialRampToValueAtTime(Math.max(40, freqFin), inicio + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, inicio);
  g.gain.exponentialRampToValueAtTime(gain, inicio + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, inicio + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(inicio); s.stop(inicio + dur + 0.02);
}

const NOTA = (semitonos, base = 440) => base * Math.pow(2, semitonos / 12);

// ---- recetas ------------------------------------------------------------------

const RECETAS = {
  // La fruta sube de tono con la racha: la cadena se OYE crecer.
  comer({ racha = 0 } = {}) {
    const f = NOTA(Math.min(racha, 24) * 0.75, 520);
    tono({ tipo: 'sine', freq: f, freqFin: f * 1.25, dur: 0.09, gain: 0.28 });
    tono({ tipo: 'triangle', freq: f * 2, dur: 0.05, gain: 0.08, t0: 0.01 });
    ruido({ dur: 0.04, gain: 0.05, freq: 3000 });
  },
  ficha() {
    tono({ tipo: 'sine', freq: NOTA(0, 880), dur: 0.12, gain: 0.25 });
    tono({ tipo: 'sine', freq: NOTA(4, 880), dur: 0.16, gain: 0.22, t0: 0.07 });
    tono({ tipo: 'sine', freq: NOTA(7, 880), dur: 0.22, gain: 0.2, t0: 0.14 });
  },
  rachaRota() {
    tono({ tipo: 'sawtooth', freq: 420, freqFin: 120, dur: 0.22, gain: 0.14 });
    ruido({ dur: 0.12, gain: 0.06, freq: 600, freqFin: 150 });
  },
  salto() {
    ruido({ dur: 0.16, gain: 0.14, filtro: 'bandpass', freq: 500, freqFin: 2600, q: 1.2 });
    tono({ tipo: 'sine', freq: 300, freqFin: 900, dur: 0.12, gain: 0.1 });
  },
  // Frenesí: suave y musical. Un soplo filtrado que se abre, un arpegio de
  // triángulo subiendo y un acorde cálido que entra en fundido. Sin sierras,
  // sin ruido áspero, sin cama: dura menos de un segundo.
  frenesiInicio() {
    ruido({ dur: 0.7, gain: 0.07, filtro: 'lowpass', freq: 400, freqFin: 3200, q: 0.5 });
    [0, 4, 7, 12, 16].forEach((s, i) => tono({ tipo: 'triangle', freq: NOTA(s, 523), dur: 0.32, gain: 0.11, t0: i * 0.075, ataque: 0.02 }));
    [0, 4, 7].forEach((s) => tono({ tipo: 'sine', freq: NOTA(s, 261), dur: 1.3, gain: 0.09, t0: 0.3, ataque: 0.35 }));
    tono({ tipo: 'sine', freq: 65, freqFin: 50, dur: 0.5, gain: 0.2, t0: 0.32, ataque: 0.03 });
  },
  frenesiFin() {
    [12, 7, 4, 0].forEach((s, i) => tono({ tipo: 'triangle', freq: NOTA(s, 392), dur: 0.3, gain: 0.09, t0: i * 0.09, ataque: 0.02 }));
    tono({ tipo: 'sine', freq: 70, freqFin: 40, dur: 0.5, gain: 0.22, t0: 0.25 });
    ruido({ dur: 0.5, gain: 0.05, filtro: 'lowpass', freq: 2000, freqFin: 150, t0: 0.2 });
  },
  // Hito de racha (cada 5): acorde que sube de tono con la racha, golpe y chispa
  hito({ n = 5 } = {}) {
    const base = 440 * Math.pow(2, Math.min(n, 25) / 30);
    [0, 4, 7, 12].forEach((s, i) => tono({ tipo: 'square', freq: NOTA(s, base), dur: 0.22, gain: 0.09, t0: i * 0.015 }));
    tono({ tipo: 'sine', freq: base / 2, freqFin: base / 5, dur: 0.22, gain: 0.28 });
    ruido({ dur: 0.3, gain: 0.09, filtro: 'highpass', freq: 4000, freqFin: 10000 });
  },
  giro() {
    tono({ tipo: 'square', freq: 1800, dur: 0.02, gain: 0.05 });
  },
  rodilloPara() {
    tono({ tipo: 'sine', freq: 160, freqFin: 60, dur: 0.12, gain: 0.3 });
    ruido({ dur: 0.06, gain: 0.12, filtro: 'lowpass', freq: 900 });
  },
  pareja({ escala = 1 } = {}) {
    [0, 4, 7].forEach((s, i) => tono({ tipo: 'triangle', freq: NOTA(s, 660), dur: 0.28, gain: 0.22 * escala, t0: i * 0.09 }));
    ruido({ dur: 0.3, gain: 0.05, filtro: 'highpass', freq: 5000, t0: 0.2 });
  },
  triple() {
    // Fanfarria: sub-golpe, arpegio ascendente doble, cola brillante
    tono({ tipo: 'sine', freq: 90, freqFin: 35, dur: 0.6, gain: 0.5 });
    ruido({ dur: 0.35, gain: 0.25, filtro: 'lowpass', freq: 3000, freqFin: 200 });
    [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => {
      tono({ tipo: 'square', freq: NOTA(s, 440), dur: 0.22, gain: 0.12, t0: 0.15 + i * 0.07 });
      tono({ tipo: 'triangle', freq: NOTA(s, 880), dur: 0.3, gain: 0.14, t0: 0.15 + i * 0.07 });
    });
    ruido({ dur: 1.2, gain: 0.12, filtro: 'highpass', freq: 3000, freqFin: 9000, t0: 0.6 });
    [0, 7, 12].forEach((s, i) => tono({ tipo: 'sine', freq: NOTA(s, 1760), dur: 0.9, gain: 0.1, t0: 0.75 + i * 0.05 }));
    // colchón de sierras desafinadas que crece bajo el arpegio: el "coro" del triple
    for (const det of [-10, 0, 10]) {
      tono({ tipo: 'sawtooth', freq: NOTA(0, 220), dur: 1.7, gain: 0.05, t0: 0.2, ataque: 0.5, desafinar: det });
      tono({ tipo: 'sawtooth', freq: NOTA(7, 220), dur: 1.7, gain: 0.04, t0: 0.2, ataque: 0.5, desafinar: det });
    }
    // segundo arpegio una octava arriba, mas rapido, remata
    [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tono({ tipo: 'triangle', freq: NOTA(s, 1760), dur: 0.18, gain: 0.07, t0: 1.0 + i * 0.045 }));
  },
  nada() {
    tono({ tipo: 'triangle', freq: NOTA(0, 330), dur: 0.2, gain: 0.18 });
    tono({ tipo: 'triangle', freq: NOTA(-5, 330), dur: 0.35, gain: 0.16, t0: 0.18 });
  },
  cobrar({ monedas = 6 } = {}) {
    const n = Math.max(3, Math.min(14, monedas));
    tono({ tipo: 'sine', freq: 70, freqFin: 40, dur: 0.22, gain: 0.3 });
    for (let i = 0; i < n; i++) {
      tono({ tipo: 'sine', freq: NOTA(Math.floor(Math.random() * 8) + i, 1320), dur: 0.12, gain: 0.14, t0: i * 0.045 });
    }
    // el "ding" de caja al final, mas largo cuanto mas cobras
    [0, 7, 12].forEach((s, i) => tono({ tipo: 'triangle', freq: NOTA(s + 12, 660), dur: 0.5 + n * 0.03, gain: 0.13, t0: n * 0.045 + i * 0.02 }));
    ruido({ dur: 0.4, gain: 0.06, filtro: 'highpass', freq: 6000, t0: n * 0.045 });
  },
  apalancarSubir({ nivel = 2 } = {}) {
    tono({ tipo: 'square', freq: NOTA(nivel * 2, 330), dur: 0.06, gain: 0.12 });
    tono({ tipo: 'square', freq: NOTA(nivel * 2 + 5, 330), dur: 0.09, gain: 0.12, t0: 0.06 });
    if (nivel >= 3) ruido({ dur: 0.25, gain: 0.05, filtro: 'bandpass', freq: 200, q: 4, t0: 0.1 });
  },
  apalancarBajar() {
    tono({ tipo: 'square', freq: 440, dur: 0.06, gain: 0.1 });
    tono({ tipo: 'square', freq: 300, dur: 0.1, gain: 0.1, t0: 0.06 });
    ruido({ dur: 0.35, gain: 0.08, filtro: 'bandpass', freq: 2500, freqFin: 300, q: 0.7, t0: 0.08 });
  },
  liquidado() {
    tono({ tipo: 'sine', freq: 120, freqFin: 28, dur: 0.9, gain: 0.55 });
    tono({ tipo: 'sawtooth', freq: 700, freqFin: 60, dur: 0.7, gain: 0.14 });
    ruido({ dur: 0.7, gain: 0.3, filtro: 'lowpass', freq: 2500, freqFin: 120 });
    for (let i = 0; i < 4; i++) tono({ tipo: 'square', freq: 220 - i * 40, dur: 0.08, gain: 0.1, t0: 0.5 + i * 0.1 });
  },
  muerte() {
    tono({ tipo: 'sine', freq: 100, freqFin: 30, dur: 0.8, gain: 0.5 });
    ruido({ dur: 0.5, gain: 0.28, filtro: 'lowpass', freq: 1800, freqFin: 100 });
    tono({ tipo: 'sawtooth', freq: 400, freqFin: 50, dur: 0.6, gain: 0.1, t0: 0.05 });
  },
  muroAviso() {
    tono({ tipo: 'square', freq: 1100, dur: 0.06, gain: 0.08 });
    tono({ tipo: 'square', freq: 1100, dur: 0.06, gain: 0.08, t0: 0.12 });
  },
  muroSalto() {
    ruido({ dur: 0.3, gain: 0.16, filtro: 'bandpass', freq: 300, freqFin: 3000, q: 1.5 });
    tono({ tipo: 'sine', freq: 200, freqFin: 1200, dur: 0.25, gain: 0.08 });
  },
  segundaVida() {
    tono({ tipo: 'sine', freq: 70, dur: 0.12, gain: 0.35 });
    tono({ tipo: 'sine', freq: 70, dur: 0.14, gain: 0.35, t0: 0.16 });
    [0, 7, 12].forEach((s, i) => tono({ tipo: 'triangle', freq: NOTA(s, 523), dur: 0.35, gain: 0.16, t0: 0.32 + i * 0.08 }));
  },
  nivel() {
    [0, 4, 7, 12].forEach((s, i) => tono({ tipo: 'triangle', freq: NOTA(s, 392), dur: 0.5, gain: 0.14, t0: i * 0.04 }));
    ruido({ dur: 0.4, gain: 0.06, filtro: 'highpass', freq: 4000, t0: 0.1 });
  },
  carta() {
    tono({ tipo: 'triangle', freq: 880, freqFin: 1320, dur: 0.1, gain: 0.16 });
    ruido({ dur: 0.05, gain: 0.05, freq: 4000 });
  },
  clic() {
    tono({ tipo: 'square', freq: 900, dur: 0.03, gain: 0.08 });
  },
  buffInicio() {
    [0, 5, 9, 14].forEach((s, i) => tono({ tipo: 'sine', freq: NOTA(s, 700), dur: 0.3, gain: 0.14, t0: i * 0.05 }));
    ruido({ dur: 0.5, gain: 0.07, filtro: 'highpass', freq: 3000, freqFin: 8000 });
  },
  buffFin() {
    tono({ tipo: 'sine', freq: 700, freqFin: 350, dur: 0.25, gain: 0.12 });
  },
  // Latido de inanicion: dos golpes graves, mas agudos y secos cuanto mas urgente
  latido({ urgencia = 0 } = {}) {
    const f0 = 55 + urgencia * 40;
    tono({ tipo: 'sine', freq: f0, freqFin: f0 * 0.6, dur: 0.11, gain: 0.32 + urgencia * 0.15 });
    tono({ tipo: 'sine', freq: f0 * 1.1, freqFin: f0 * 0.6, dur: 0.1, gain: 0.26 + urgencia * 0.15, t0: 0.14 });
    if (urgencia > 0.6) ruido({ dur: 0.05, gain: 0.06, filtro: 'highpass', freq: 4000 });
  },
  hambre() {
    tono({ tipo: 'sawtooth', freq: 180, freqFin: 90, dur: 0.18, gain: 0.12 });
    ruido({ dur: 0.1, gain: 0.08, filtro: 'lowpass', freq: 800 });
  },
  frutaPerdida() {
    tono({ tipo: 'triangle', freq: 500, freqFin: 250, dur: 0.15, gain: 0.1 });
  }
};

export function tocar(nombre, opts) {
  if (!ctx || silenciado) return;
  const r = RECETAS[nombre];
  if (!r) return;
  try { r(opts || {}); } catch (e) { /* un fallo de audio jamás rompe el juego */ }
}

export const NOMBRES = Object.keys(RECETAS);
