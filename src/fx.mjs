// fx.mjs — efectos visuales del canvas: ondas de choque, flashes, glitch,
// vitrina holográfica (scanlines, viñeta, borde), rastro y utilidades de color.
// Todo es JS sobre Canvas 2D: sin @keyframes ni filter, por rendimiento.
// Las funciones reciben el contexto y el estado; no guardan nada propio salvo
// la viñeta cacheada por tamaño.

export const CIAN = '#00E5FF';
export const MAGENTA = '#FF4081';
export const ORO = '#FFD54F';
export const VERDE = '#00E676';
export const ROJO = '#FF1744';
export const VIOLETA = '#E040FB';

// Tono del cuerpo según la racha: cian en frío, hacia magenta a ×4.
export function tonoRacha(multRacha, frenesi) {
  if (frenesi) return 320;             // rosa caliente
  const f = Math.max(0, Math.min(1, (multRacha - 1) / 3));
  return 185 + f * 110;                // 185 cian -> 295 violeta
}

export function hsl(h, s, l, a = 1) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

// ---- ondas de choque -----------------------------------------------------------

export function onda(g, x, y, { maxR = 90, dur = 0.5, color = CIAN, grosor = 3 } = {}) {
  if (!g.ondas) g.ondas = [];
  g.ondas.push({ x, y, r: 4, maxR, vida: dur, dur, color, grosor });
  if (g.ondas.length > 24) g.ondas.splice(0, g.ondas.length - 24);
}

export function actualizarOndas(g, dt) {
  if (!g.ondas) return;
  for (let i = g.ondas.length - 1; i >= 0; i--) {
    const o = g.ondas[i];
    o.vida -= dt;
    if (o.vida <= 0) { g.ondas.splice(i, 1); continue; }
    const p = 1 - o.vida / o.dur;
    o.r = 4 + (o.maxR - 4) * (1 - Math.pow(1 - p, 2.2)); // sale rápido, frena
  }
}

export function dibujarOndas(c, g) {
  if (!g.ondas || !g.ondas.length) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const o of g.ondas) {
    const a = Math.max(0, o.vida / o.dur);
    c.strokeStyle = o.color;
    c.globalAlpha = a * 0.9;
    c.lineWidth = o.grosor * (0.4 + a);
    c.beginPath();
    c.arc(o.x, o.y, o.r, 0, Math.PI * 2);
    c.stroke();
    c.globalAlpha = a * 0.25;
    c.lineWidth = o.grosor * 4 * a;
    c.stroke();
  }
  c.restore();
}

// ---- flash de pantalla --------------------------------------------------------

export function flash(g, color, fuerza = 0.5, dur = 0.35) {
  g.flash = { color, alpha: fuerza, dur, vida: dur };
}

export function actualizarFlash(g, dt) {
  if (!g.flash) return;
  g.flash.vida -= dt;
  if (g.flash.vida <= 0) g.flash = null;
}

export function dibujarFlash(c, g, w, h) {
  if (!g.flash) return;
  const a = g.flash.alpha * Math.pow(g.flash.vida / g.flash.dur, 1.6);
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = a;
  c.fillStyle = g.flash.color;
  c.fillRect(0, 0, w, h);
  c.restore();
}

// ---- vitrina holográfica -------------------------------------------------------

let vinetaCache = null;
function vineta(c, w, h) {
  if (vinetaCache && vinetaCache.w === w && vinetaCache.h === h) return vinetaCache.grad;
  const grad = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, 'rgba(0, 4, 14, 0.75)');
  vinetaCache = { w, h, grad };
  return grad;
}

// Fondo: negro azulado, grilla que late con la racha, tinte de frenesí/bajón.
export function dibujarFondo(c, g, w, h, t, tiempo) {
  const frenesi = g.frenesiActiva;
  const bajon = g.bajonTimer > 0;
  c.fillStyle = frenesi ? '#12060F' : bajon ? '#070A0F' : '#060A14';
  c.fillRect(0, 0, w, h);

  const mult = g.racha ? 1 + 0.25 * g.racha : 1;
  const pulso = 0.5 + 0.5 * Math.sin(tiempo * (frenesi ? 9 : 2.2));
  const alfaGrilla = frenesi ? 0.10 + 0.08 * pulso : 0.045 + Math.min(0.09, (mult - 1) * 0.03) + 0.015 * pulso;
  c.strokeStyle = frenesi ? `rgba(255, 64, 129, ${alfaGrilla})` : `rgba(0, 229, 255, ${alfaGrilla})`;
  c.lineWidth = 1;
  c.beginPath();
  for (let x = 0; x <= w; x += t) { c.moveTo(x, 0); c.lineTo(x, h); }
  for (let y = 0; y <= h; y += t) { c.moveTo(0, y); c.lineTo(w, y); }
  c.stroke();

  // Scanlines que bajan despacio: la pantalla es un holograma, no un papel
  const desfase = (tiempo * 18) % 4;
  c.fillStyle = 'rgba(0, 0, 0, 0.13)';
  for (let y = -4 + desfase; y < h; y += 4) c.fillRect(0, y, w, 1.2);
}

export function dibujarVineta(c, g, w, h) {
  c.save();
  c.fillStyle = vineta(c, w, h);
  c.fillRect(0, 0, w, h);
  c.restore();
}

// Borde luminoso del frenesí / bajón / buff: un marco que respira.
export function dibujarBorde(c, g, w, h, tiempo) {
  let color = null;
  let fuerza = 0;
  if (g.inanicion > 0) { color = ROJO; fuerza = 0.5 + 0.4 * Math.max(0, Math.sin(tiempo * 12)); }
  else if (g.frenesiActiva) { color = MAGENTA; fuerza = 0.55 + 0.35 * Math.sin(tiempo * 10); }
  else if (g.bajonTimer > 0) { color = '#5B7BB0'; fuerza = 0.35; }
  else if (g.buff === 'escudo') { color = VERDE; fuerza = 0.35 + 0.2 * Math.sin(tiempo * 6); }
  else if (g.buff) { color = ORO; fuerza = 0.25 + 0.15 * Math.sin(tiempo * 6); }
  else if (g.apalancamiento >= 3) { color = ROJO; fuerza = 0.18 + 0.1 * Math.sin(tiempo * 3); }
  if (!color) return;
  const grosor = 26;
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = fuerza;
  const lados = [
    [0, 0, w, grosor, 0, 0, 0, grosor],
    [0, h - grosor, w, grosor, 0, h, 0, h - grosor],
    [0, 0, grosor, h, 0, 0, grosor, 0],
    [w - grosor, 0, grosor, h, w, 0, w - grosor, 0]
  ];
  for (const [x, y, ww, hh, gx0, gy0, gx1, gy1] of lados) {
    const grad = c.createLinearGradient(gx0, gy0, gx1, gy1);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = grad;
    c.fillRect(x, y, ww, hh);
  }
  c.restore();
}

// ---- glitch de muerte ----------------------------------------------------------

// Corta el canvas en bandas y las desplaza: el holograma se rompe.
export function dibujarGlitch(c, canvas, intensidad) {
  if (intensidad <= 0) return;
  const w = canvas.width;
  const h = canvas.height;
  const bandas = 6 + Math.floor(intensidad * 10);
  c.save();
  for (let i = 0; i < bandas; i++) {
    const y = Math.floor(Math.random() * h);
    const alto = 2 + Math.floor(Math.random() * 18 * intensidad);
    const dx = Math.round((Math.random() - 0.5) * 60 * intensidad);
    c.drawImage(canvas, 0, y, w, alto, dx, y, w, alto);
  }
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = 0.18 * intensidad;
  c.fillStyle = ROJO;
  c.fillRect(0, 0, w, h);
  c.restore();
}

// ---- artefactos -----------------------------------------------------------------

// Glifo vectorial por tipo, halo aditivo y anillo de vida que se consume.
export function dibujarArtefacto(c, a, t, tiempo, color, vida) {
  const cx = (a.x + 0.5) * t;
  const cy = (a.y + 0.5) * t;
  const r = t * 0.42;
  const parpadeo = vida < 0.25 && Math.floor(tiempo * 8) % 2 === 0;
  c.save();
  c.translate(cx, cy);
  c.globalAlpha = parpadeo ? 0.45 : 1;
  // halo
  c.globalCompositeOperation = 'lighter';
  const halo = c.createRadialGradient(0, 0, r * 0.2, 0, 0, r + 8);
  halo.addColorStop(0, color);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = halo;
  c.globalAlpha *= 0.3;
  c.beginPath(); c.arc(0, 0, r + 8, 0, Math.PI * 2); c.fill();
  c.globalAlpha = parpadeo ? 0.45 : 1;
  c.globalCompositeOperation = 'source-over';
  // anillo de vida
  c.strokeStyle = color; c.lineWidth = 2;
  c.beginPath(); c.arc(0, 0, r + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * vida); c.stroke();
  // glifo
  c.lineWidth = 2; c.lineCap = 'round'; c.lineJoin = 'round';
  if (a.tipo === 'portal') {
    c.rotate(tiempo * 2.5);
    for (let i = 0; i < 2; i++) {
      c.beginPath(); c.arc(0, 0, r * (0.75 - i * 0.3), i * Math.PI, i * Math.PI + Math.PI * 1.4); c.stroke();
    }
  } else if (a.tipo === 'impulso') {
    const d = ((tiempo * 1.5) % 1) * r * 0.5 - r * 0.25;
    for (let i = -1; i <= 1; i++) {
      c.beginPath(); c.moveTo(-r * 0.35 + i * r * 0.3 + d, -r * 0.45); c.lineTo(r * 0.05 + i * r * 0.3 + d, 0); c.lineTo(-r * 0.35 + i * r * 0.3 + d, r * 0.45); c.stroke();
    }
  } else if (a.tipo === 'barrido') {
    c.rotate(Math.sin(tiempo * 3) * 0.3);
    c.lineWidth = 3;
    c.beginPath(); c.arc(0, r * 0.1, r * 0.55, Math.PI, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(-r * 0.55, r * 0.1); c.lineTo(-r * 0.55, r * 0.5); c.moveTo(r * 0.55, r * 0.1); c.lineTo(r * 0.55, r * 0.5); c.stroke();
  } else {
    c.rotate(tiempo * 1.2);
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2; const rr = i % 2 ? r * 0.35 : r * 0.8;
      c.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
    }
    c.closePath(); c.stroke();
  }
  c.restore();
}

// ---- rastro de la cabeza --------------------------------------------------------

export function registrarRastro(g, x, y) {
  if (!g.rastro) g.rastro = [];
  g.rastro.unshift({ x, y, vida: 1 });
  if (g.rastro.length > 7) g.rastro.length = 7;
}

export function actualizarRastro(g, dt) {
  if (!g.rastro) return;
  for (const r of g.rastro) r.vida = Math.max(0, r.vida - dt * 3.2);
}

export function dibujarRastro(c, g, t, hue) {
  if (!g.rastro) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (let i = 1; i < g.rastro.length; i++) {
    const r = g.rastro[i];
    if (r.vida <= 0) continue;
    const k = r.vida * (1 - i / g.rastro.length);
    c.fillStyle = hsl(hue, 100, 60, 0.22 * k);
    c.beginPath();
    c.arc((r.x + 0.5) * t, (r.y + 0.5) * t, t * 0.42 * (0.6 + 0.4 * k), 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

// ---- monedas que vuelan al marcador -------------------------------------------

export function lanzarMonedas(g, x, y, tx, ty, cantidad) {
  if (!g.monedas) g.monedas = [];
  for (let i = 0; i < cantidad; i++) {
    g.monedas.push({ x, y, tx, ty, t: -i * 0.03, cx: x + (Math.random() - 0.5) * 220, cy: y - 80 - Math.random() * 120 });
  }
}

export function actualizarMonedas(g, dt) {
  if (!g.monedas) return 0;
  let llegadas = 0;
  for (let i = g.monedas.length - 1; i >= 0; i--) {
    const m = g.monedas[i];
    m.t += dt * 1.8;
    if (m.t >= 1) { g.monedas.splice(i, 1); llegadas++; }
  }
  return llegadas;
}

export function dibujarMonedas(c, g) {
  if (!g.monedas || !g.monedas.length) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const m of g.monedas) {
    if (m.t < 0) continue;
    const p = m.t;
    const u = 1 - p;
    const x = u * u * m.x + 2 * u * p * m.cx + p * p * m.tx;
    const y = u * u * m.y + 2 * u * p * m.cy + p * p * m.ty;
    c.fillStyle = ORO;
    c.globalAlpha = 0.9;
    c.beginPath();
    c.arc(x, y, 4, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 0.35;
    c.beginPath();
    c.arc(x, y, 8, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

// ---- texto con brillo -----------------------------------------------------------

export function textoBrillante(c, texto, x, y, { color = '#FFFFFF', tam = 13, peso = 700, alfa = 1, glow = 10, alinear = 'center' } = {}) {
  c.save();
  c.globalAlpha = alfa;
  c.font = `${peso} ${tam}px "Saira", "Segoe UI", system-ui, sans-serif`;
  c.textAlign = alinear;
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  c.lineWidth = 4;
  c.strokeStyle = 'rgba(3, 6, 14, 0.85)';
  c.strokeText(texto, x, y);
  c.shadowColor = color;
  c.shadowBlur = glow;
  c.fillStyle = color;
  c.fillText(texto, x, y);
  c.restore();
}
