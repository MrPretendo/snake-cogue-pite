// Snake Cogue Pite: un snake roguelite de apuesta.
// - Carrera euforica por la cola mas larga.
// - Posibilidad de cruzar/saltar por encima de tu propia cola consumiendo energia.
// - Consumo de energia metabolica escalado proporcionalmente a la longitud de la cola.
// - Frutas situadas progresivamente mas lejos a medida que la serpiente crece.
// - Sistema roguelite con cartas de mutacion al subir de nivel o comer frutas mutantes.
// - Bucle de apuesta: cada fruta encadenada sube una RACHA que multiplica lo que
//   entra al BOTE; el bote se cobra a mano (x1), lo paga la fruta JACKPOT con un
//   rodillo (x0..x20) o se pierde al morir. El APALANCAMIENTO multiplica bote y
//   gasto a la vez, y desde x3 quedarse sin energia LIQUIDA la run.
// - FRENESI: un medidor que llenan las frutas; al tope, segundos a medio
//   gasto, mas rapido y con bote doble, seguidos de un BAJON con gasto extra.
// - TRAGAPERRAS: la unica fuente de invencibilidad y paro del metabolismo, y del
//   iman GLOBAL (la carta Iman Cuantico es un iman corto, tope 7 casillas).
// Contrato con el anfitrión: mount/unmount/activate/freeze/thaw.
// NO persiste en disco, NO usa bucles de temporizador sin control.

import { inyectarSprite, ico } from './iconos.mjs';
import * as sfx from './sonido.mjs';
import * as musica from './musica.mjs';
import * as ranking from './ranking.mjs';
import * as fx from './fx.mjs';
import { T, idioma, alternarIdioma } from './idioma.mjs';

const TAU = Math.PI * 2;
const TICK_MS = 25; // ~40 FPS para simulacion fisica y movimiento fluido
const GRID_SIZE = 22; // Pixeles por casilla del tablero

// Resolucion logica de la app. El anfitrion la escala para encajar en su hueco;
// el juego siempre se mide a este tamano. Arena = alto - HUD (64) - pie (34) =
// 502 px -> 36x22 casillas, la grilla para la que estan afinadas las distancias.
export const RESOLUCION = Object.freeze({ ancho: 800, alto: 600 });

// ---- bucle de apuesta -------------------------------------------------------
const RACHA_VENTANA_MAX = 3.5;     // s para encadenar la siguiente fruta con racha 0
const RACHA_VENTANA_MIN = 1.5;     // la ventana se estrecha 0.12 s por fruta encadenada
const RACHA_MULT_POR_FRUTA = 0.25; // x1.25, x1.50, x1.75...
const RACHA_MULT_TOPE = 4.0;
const FRENESI_DURACION = 8;        // s de frenesi
const FRENESI_POR_FRUTA = 0.09;    // + FRENESI_POR_RACHA * racha; ~9 frutas encadenadas para llenarlo
const FRENESI_POR_RACHA = 0.012;
const FRENESI_ENFRIADO = 0.07;     // por segundo sin racha
const BAJON_DURACION = 4;          // s de resaca: gasto x1.6, velocidad -10%
const BAJON_GASTO = 1.6;
const NIVELES_APALANCAMIENTO = [1, 2, 3, 5];
const APALANCAMIENTO_DEGEN = 10;   // lo desbloquea la carta Modo Degen
const LIQUIDACION_DESDE = 3;       // con x3 o mas, energia 0 = run liquidada, sin gracia
const GASTO_POR_APALANCAMIENTO = 0.35; // gasto base x(1 + 0.35*(L-1)): x2->1.35, x5->2.4, x10->4.15
// Piso metabolico proporcional a la cola, que NINGUNA carta rebaja: las cartas
// solo pueden bajar la formula hasta aqui. Cola 100 -> 3.5/s, 200 -> 6, 500 -> 13.5.
// Sin esto, Resonancia a cola 500 (0.85^50) dejaba el gasto en cero.
const GASTO_PISO_BASE = 1.0;
const GASTO_PISO_POR_SEGMENTO = 0.025;
const RESONANCIA_TRAMOS_MAX = 5;      // tope de tramos de 10 casillas que mitigan
const PENALIZACION_BAJAR = 0.25;   // fraccion del bote que se quema al bajar apalancamiento
const VELOCIDAD_POR_APALANCAMIENTO = 0.04; // +4% de velocidad por nivel: x5 -> +16%, x10 -> +36%

// ---- inanicion --------------------------------------------------------------
// Sin energia la cola se QUEMA, y mas rapido cuanto mas larga llego a ser:
// la velocidad sale de la cola maxima de la run (pico / 3 s) y no baja nunca,
// asi que una cola recuperada tras perderla arde igual de rapido y se acaba
// antes. Antes era un segmento cada 1.25 s: con cola larga, mas de un minuto
// de gracia y el hambre no mataba a nadie. Desde x3 no hay margen (liquidacion).
const INANICION_GRACIA = 0.75;          // s de aviso antes de que arda la cola
const INANICION_SEGUNDOS_AL_PICO = 3;   // la cola maxima entera se va en este tiempo
const INANICION_MIN_SEG_S = 2;          // nunca menos de 2 segmentos por segundo
const COLA_MINIMA = 2;                  // por debajo, muerte

// ---- tragaperras -------------------------------------------------------------
// La fruta dorada es una FICHA. Con tres fichas salta la tragaperras: tres
// rodillos con cinco simbolos. Pareja: la mejora temporal del simbolo. Triple:
// la mejora Y el bote se cobra x3. Nada: consuelo de energia.
const JACKPOT_FRUTAS = 3;
const BUFF_DURACION = 9;           // s de cada mejora temporal
const TRAGAPERRAS_SIMBOLOS = Object.freeze([
  { id: 'escudo', icon: 'escudo', name: 'INVENCIBLE', desc: 'nada te mata y la cola se cruza gratis' },
  { id: 'energia', icon: 'rayo', name: 'SIN GASTO', desc: 'la energía no baja' },
  { id: 'iman', icon: 'iman', name: 'IMÁN TOTAL', desc: 'atraes todas las frutas de la arena' },
  { id: 'bote', icon: 'monedas', name: 'BOTE DOBLE', desc: 'todo lo que entra al bote ×2' },
  { id: 'lento', icon: 'tortuga', name: 'CÁMARA LENTA', desc: 'media velocidad, medio gasto' }
]);
const TRAGAPERRAS_PESOS = Object.freeze({ triple: 12, pareja: 58, nada: 30 });
const TRAGAPERRAS_PARADAS = [0.9, 1.5, 2.1]; // s en que se detiene cada rodillo
const TRAGAPERRAS_MOSTRAR = 1.8;             // s mostrando el resultado antes de seguir
const TRAGAPERRAS_CONSUELO = 40;             // energia si no sale ni pareja
// Dos imanes: el de la carta Iman Cuantico (radio corto, mejora hasta un tope)
// y el de la tragaperras, GLOBAL durante el buff, con tiron a velocidad fija.
const IMAN_CARTA_BASE = 2;       // casillas con un nivel
const IMAN_CARTA_POR_NIVEL = 1;  // +1 casilla por nivel extra
const IMAN_CARTA_TOPE = 7;       // nunca mas de 7 casillas
const IMAN_TOTAL_TIRON = 1.0;    // casillas por tick con Iman Total (40/s)
const VALOR_FRUTA = Object.freeze({ normal: 10, hyper: 15, phase: 20, mutant: 40 });

// ---- ritmo de niveles --------------------------------------------------------
// Comer mas rapido paga en el bote, NO en niveles. Los perks que aceleran el
// consumo diluyen la XP por fruta y, tras subir de nivel, la XP entra a un
// tercio unos segundos: asi el modal de cartas no vuelve cada 4 s con iman +
// frutas multiples, que era lo que "ralentizaba" el juego.
const XP_DILUCION_FRUTAS = 0.5;  // divisor += 0.5 por nivel de Frutas Multiples
const XP_DILUCION_IMAN = 0.25;   // divisor += 0.25 por nivel de Iman Cuantico
const NIVEL_ENFRIAMIENTO = 12;   // s tras subir de nivel
const XP_EN_ENFRIAMIENTO = 0.35;

// ---- mecanicas superiores ----------------------------------------------------
// Tres categorias, tres mecanicas cada una. Antes de cada run el juego ofrece
// TRES cartas: [dos mecanicas de categorias distintas] · Clasica · [otras dos].
// `mult` multiplica todo lo que entra a puntos y bote; en una carta doble se
// multiplican entre si. Son hipotesis: probar jugando.
const CATEGORIAS = Object.freeze({
  atencion: { nombre: 'Atención', color: '#FFD54F' },
  beneficio: { nombre: 'Beneficio', color: '#00E676' },
  nerf: { nombre: 'Nerf', color: '#FF5252' }
});

const MECANICAS = Object.freeze([
  // -- atencion: obligan a mirar
  {
    id: 'muro_errante', cat: 'atencion', icon: 'muro', name: 'Muro Errante', mult: 3, muroErrante: true,
    desc: 'Tres muros matan. El libre cambia de sitio.'
  },
  {
    id: 'cola', cat: 'atencion', icon: 'prohibido', name: 'Cola Intocable', mult: 3, colaIntocable: true, eje: 'salto',
    excluye: ['phantom_vault', 'elastic_body'],
    desc: 'Tocar tu cola es el fin.'
  },
  {
    id: 'fugaces', cat: 'atencion', icon: 'reloj', name: 'Frutas Fugaces', mult: 1.5, frutasFugaces: 7,
    desc: 'Las frutas caducan a los 7 s.'
  },
  // -- beneficio: regalan algo (y por eso el bote paga menos)
  {
    id: 'turbo_gratis', cat: 'beneficio', icon: 'viento', name: 'Turbo Gratis', mult: 0.8, turboGratis: true,
    desc: 'El dash no gasta energía.'
  },
  {
    id: 'metabolismo_lento', cat: 'beneficio', icon: 'tortuga', name: 'Metabolismo Lento', mult: 0.8, gasto: 0.6, eje: 'gasto',
    desc: 'Gastas un 40 % menos de energía.'
  },
  {
    id: 'segunda_vida', cat: 'beneficio', icon: 'corazon', name: 'Segunda Vida', mult: 0.75, vidasExtra: 1,
    desc: 'La primera muerte se perdona.'
  },
  // -- nerf: lo hacen mas dificil
  {
    id: 'salto_caro', cat: 'nerf', icon: 'billete', name: 'Salto Caro', mult: 1.5, saltoCoste: 2, eje: 'salto',
    desc: 'Saltar la cola cuesta el doble.'
  },
  {
    id: 'metabolismo', cat: 'nerf', icon: 'fuego', name: 'Metabolismo Doble', mult: 1.75, gasto: 2, eje: 'gasto',
    desc: 'Gastas el doble de energía.'
  },
  {
    id: 'volatil', cat: 'nerf', icon: 'candado', name: 'Bote Volátil', mult: 2, sinCobro: true,
    desc: 'No puedes cobrar. Sólo paga el jackpot.'
  }
]);

// Fuera del mazo, medidas y a mano por si vuelven.
const MECANICAS_RESERVA = Object.freeze([
  { id: 'muros', cat: 'atencion', icon: 'muro', name: 'Muros de Acero', mult: 1.5, muros: true, desc: 'Los bordes ya no envuelven: tocar un muro es la muerte.' },
  { id: 'velocidad', cat: 'nerf', icon: 'velocimetro', name: 'Velocidad Triple', mult: 2.5, velocidad: 3, desc: 'La serpiente avanza al triple de velocidad base.' },
  { id: 'apalancada', cat: 'nerf', icon: 'subida', name: 'Todo Apalancado', mult: 1.25, apalancamientoMin: 5, desc: 'Empiezas a ×5 y no puedes bajar.' }
]);

// ---- artefactos -------------------------------------------------------------
// Objetos temporales en la arena: aparecen cada 18-30 s, duran 15 s y se
// recogen pasando la cabeza por encima. Portal (A<->B), impulso (5 s de
// velocidad sin gasto, decreciente), barrido (tira de todas las frutas y las
// duplica) y euforia (frenesí inmediato).
const ARTEFACTO_CADENCIA_MIN = 18;
const ARTEFACTO_CADENCIA_MAX = 30;
const ARTEFACTO_VIDA = 15;
const ARTEFACTO_DIST_MIN = 6;
const IMPULSO_DURACION = 5;
const IMPULSO_VELOCIDAD = 0.7;   // hasta +70% al empezar, bajando a 0
const BARRIDO_DURACION = 1.2;
const BARRIDO_TIRON = 1.6;       // casillas por tick
const BARRIDO_EXTRA_MAX = 8;     // frutas nuevas como mucho al duplicar
const ARTEFACTO_TIPOS = Object.freeze(['portal', 'impulso', 'barrido', 'euforia']);

const BONO_NO_CLASICA = 4;       // x4 a puntos y bote por jugar con cualquier mecanica

const MURO_CADENCIA = 6;        // s entre saltos del muro libre (Muro Errante)
const MURO_AVISO = 1.2;         // s de aviso antes del salto
const MUROS = Object.freeze(['arriba', 'derecha', 'abajo', 'izquierda']);

// Une una lista de mecanicas en el objeto de reglas que lee el juego.
function fusionarMecanicas(lista) {
  const r = {
    ids: lista.map((m) => m.id),
    lista,
    nombre: lista.length ? lista.map((m) => T('mec.' + m.id + '.name', null, m.name)).join(' + ') : T('sel.clasica'),
    mult: 1, gasto: 1, saltoCoste: 1, velocidad: 1, vidasExtra: 0, excluye: []
  };
  for (const m of lista) {
    r.mult *= m.mult;
    if (m.gasto) r.gasto *= m.gasto;
    if (m.saltoCoste) r.saltoCoste *= m.saltoCoste;
    if (m.velocidad) r.velocidad *= m.velocidad;
    if (m.vidasExtra) r.vidasExtra += m.vidasExtra;
    if (m.excluye) r.excluye.push(...m.excluye);
    for (const k of ['muros', 'muroErrante', 'colaIntocable', 'sinCobro', 'turboGratis', 'frutasFugaces', 'apalancamientoMin']) {
      if (m[k]) r[k] = m[k];
    }
  }
  // Elegir cualquier carta que no sea Clasica multiplica la ganancia x4 encima
  // del producto de sus dos mecanicas: es lo que compensa el riesgo.
  if (lista.length) r.mult *= BONO_NO_CLASICA;
  r.mult = Math.round(r.mult * 100) / 100;
  return r;
}

// Una oferta = tres listas: [dos de categorias distintas], [] (Clasica), [otras dos].
// Las cuatro mecanicas laterales no se repiten, dos del mismo `eje` no comparten
// carta (Metabolismo Lento + Doble se anulan; Salto Caro sin saltos no es nada)
// y se evita repetir la oferta anterior.
let ultimaOferta = '';
function generarOferta() {
  const cats = Object.keys(CATEGORIAS);
  const porCat = (c) => MECANICAS.filter((m) => m.cat === c);
  const azar = (arr) => arr[Math.floor(Math.random() * arr.length)];
  for (let intento = 0; intento < 20; intento++) {
    const usadas = new Set();
    const lados = [];
    for (let lado = 0; lado < 2; lado++) {
      const c1 = azar(cats);
      const c2 = azar(cats.filter((c) => c !== c1));
      const m1 = azar(porCat(c1).filter((m) => !usadas.has(m.id)));
      const m2 = azar(porCat(c2).filter((m) => !usadas.has(m.id) && !(m.eje && m.eje === m1.eje)));
      if (!m1 || !m2) break;
      usadas.add(m1.id); usadas.add(m2.id);
      lados.push([m1, m2]);
    }
    if (lados.length < 2) continue;
    const firma = lados.map((l) => l.map((m) => m.id).sort().join('+')).sort().join('|');
    if (firma === ultimaOferta && intento < 19) continue;
    ultimaOferta = firma;
    return [lados[0], [], lados[1]];
  }
  return [[MECANICAS[0], MECANICAS[3]], [], [MECANICAS[6], MECANICAS[1]]];
}

// Records de la sesion (no persisten en disco, como el resto del juego).
const records = { puntos: 0, cola: 4 };

// Enlace del creador (menú → Acerca de y esquina del menú).
const ENLACE_PATREON = 'https://www.patreon.com/c/MrPretendo';
const ENLACE_GITHUB = 'https://github.com/MrPretendo/snake-cogue-pite';

// Ranking (Supabase, plan gratuito). La clave es la publica: las reglas de la
// tabla (tools/ranking.sql) deciden que puede hacer un visitante.
const RANKING = {
  url: 'https://fhdfagvisnflioygciir.supabase.co',
  clave: 'sb_publishable_Q7no2Zy9_fP6DXafte3W2w_523Btu3A'
};
ranking.configurar(RANKING);

function calculateXpNext(level) {
  // Progresión exponencial ajustada a la XP nerfeada de frutas (5 a 14 XP):
  // - Nivel 1: 20 XP (~4 frutas normales o 2 especiales)
  // - Nivel 5: 38 XP (~8 frutas normales)
  // - Nivel 10: 85 XP (~17 frutas normales)
  // - Nivel 15: 190 XP (~38 frutas normales)
  // - Nivel 20: 425 XP (~85 frutas normales)
  // - Nivel 25: 950 XP (~190 frutas normales)
  return Math.round(20 * Math.pow(1.17, level - 1));
}

function getCryoMultiplier(stacks) {
  if (stacks <= 0) return 1.0;
  let mult = 1.0;
  for (let k = 1; k <= stacks; k++) {
    // La efectividad va bajando progresivamente hasta proporcionar solo un 15%
    // (+15% sobre lo original: -34.5% al nivel 1)
    const eff = Math.max(0.15, 0.15 + 0.15 / k) * 1.15;
    mult *= (1.0 - eff);
  }
  return mult;
}

function getMagnetRange(stacks) {
  if (stacks <= 0) return 0;
  return Math.min(IMAN_CARTA_TOPE, IMAN_CARTA_BASE + IMAN_CARTA_POR_NIVEL * (stacks - 1));
}

const PERK_CATALOG = [
  {
    id: 'cryo_metabolism',
    icon: 'cryo',
    name: 'Metabolismo Criogénico',
    desc: 'Reduce el drenaje por longitud con efectividad decreciente (-34% nivel 1, bajando hasta aportar 17% por nivel).',
    badge: 'Pasivo'
  },
  {
    id: 'phantom_vault',
    icon: 'fantasma',
    name: 'Salto Fantasma',
    desc: 'Corta el costo de salto de cola a solo 4 de energía y otorga +3 saltos cuánticos gratis inmediatos por nivel.',
    badge: 'Movilidad'
  },
  {
    id: 'quantum_magnet',
    icon: 'iman',
    name: 'Imán Cuántico',
    desc: 'Atrae frutas a 2 casillas; +1 casilla por nivel, hasta 7.',
    badge: 'Utilidad'
  },
  {
    id: 'twin_fruits',
    icon: 'frutas',
    name: 'Frutas Múltiples',
    desc: 'Despliega 3 frutas simultáneas en arena (+2 por nivel adicional) creando densos campos de caza.',
    badge: 'Arena'
  },
  {
    id: 'turbo_efficient',
    icon: 'rayo',
    name: 'Dash Sobrecargado',
    desc: 'El turbo consume 80% menos energía y otorga +25% de velocidad.',
    badge: 'Turbo'
  },
  {
    id: 'battery_upgrade',
    icon: 'bateria',
    name: 'Batería Nuclear',
    desc: 'Capacidad máxima de energía +50 de energía (acumulable) y las frutas restauran +18 de energía extra por nivel.',
    badge: 'Energía'
  },
  {
    id: 'hyperspace_compass',
    icon: 'brujula',
    name: 'Sensor Hiperespacial',
    desc: 'Guía holográfica con +35% velocidad hacia la fruta y reduce el drenaje metabólico un 40%.',
    badge: 'Navegación'
  },
  {
    id: 'elastic_body',
    icon: 'adn',
    name: 'Cuerpo Elástico',
    desc: '100% de probabilidad garantizada de regenerar +15 de energía en cada salto de cola.',
    badge: 'Supervivencia'
  },
  {
    id: 'dense_nutrition',
    icon: 'carne',
    name: 'Nutrición Densa',
    desc: 'Doble de experiencia (x2 XP) en todas las frutas, +12 de energía por nivel y cada fruta alarga la cola un segmento extra por nivel.',
    badge: 'Crecimiento'
  },
  {
    id: 'cosmic_resonance',
    icon: 'orbita',
    name: 'Resonancia Ouroboros',
    desc: 'Cada 10 casillas de cola, tu velocidad aumenta +12% y el drenaje por longitud se mitiga un 17%.',
    badge: 'Legendario'
  },
  {
    id: 'manos_diamante',
    icon: 'gema',
    name: 'Manos de Diamante',
    desc: 'Al morir, el bote en juego no se pierde: se cobra al 50% (+25% por nivel, hasta el 100%).',
    badge: 'Apuesta'
  },
  {
    id: 'martingala',
    icon: 'dados',
    name: 'Martingala',
    desc: 'Tras una tirada sin pareja, la siguiente garantiza pareja.',
    badge: 'Apuesta'
  },
  {
    id: 'sin_resaca',
    icon: 'bebida',
    name: 'Sin Resaca',
    desc: 'Elimina el bajón tras el frenesí. Cada nivel extra alarga el frenesí +2s.',
    badge: 'Frenesí'
  },
  {
    id: 'degen',
    icon: 'cohete',
    name: 'Modo Degen',
    desc: 'Desbloquea apalancamiento x10: el bote entra x10, el gasto base x4.15 y cada salto de cola cuesta 100 de energía.',
    badge: 'Legendario'
  }
];

let inst = null;

// Todo el marcado pasa por T(): reconstruirlo es cambiar de idioma.
function marcadoUI() {
  return [
    '<div class="sr-hud">',
    '  <div class="sr-mod sr-mod--energia">',
    '    <div class="sr-mod__cab"><span class="sr-mod__lbl">' + T('hud.energia') + '</span><span class="sr-hud__drain">−2.2/s</span></div>',
    '    <div class="sr-mod__fila">',
    '      <div class="sr-hud__energy-wrap"><div class="sr-hud__energy-bar" data-status="normal"></div></div>',
    '      <span class="sr-hud__val sr-hud__energy-text">100/100</span>',
    '    </div>',
    '  </div>',
    '  <div class="sr-mod sr-mod--ritmo">',
    '    <div class="sr-mod__fila">',
    '      <span class="sr-mod__lbl">' + T('hud.racha') + '</span>',
    '      <span class="sr-hud__val sr-hud__racha-text">×1.00</span>',
    '      <div class="sr-meter sr-meter--racha"><div class="sr-meter__bar sr-hud__racha-bar"></div></div>',
    '    </div>',
    '    <div class="sr-mod__fila">',
    '      <span class="sr-mod__lbl">' + T('hud.frenesi') + '</span>',
    '      <div class="sr-meter sr-meter--frenesi"><div class="sr-meter__bar sr-hud__frenesi-bar" data-activa="0"></div></div>',
    '      <span class="sr-hud__frenesi-text"></span>',
    '    </div>',
    '  </div>',
    '  <div class="sr-mod sr-mod--progreso">',
    '    <div class="sr-mod__fila">',
    '      <span class="sr-mod__lbl">' + T('hud.nivel') + '</span><span class="sr-hud__val sr-hud__xp">1</span>',
    '      <div class="sr-hud__xp-wrap"><div class="sr-hud__xp-bar"></div></div>',
    '      <span class="sr-hud__val sr-hud__xp-text">0/20</span>',
    '    </div>',
    '    <div class="sr-mod__fila sr-mod__fila--stats">',
    '      <span class="sr-stat"><span class="sr-mod__lbl">' + T('hud.cola') + '</span><span class="sr-hud__val sr-hud__length">4</span></span>',
    '      <span class="sr-stat"><span class="sr-mod__lbl">' + T('hud.frutas') + '</span><span class="sr-hud__val sr-hud__score">0</span></span>',
    '      <span class="sr-stat sr-stat--fichas" title="' + T('hud.fichasTitulo') + '">' + ico('ficha', 'sr-ico--hud') + '<span class="sr-hud__val sr-hud__fichas-n">0/3</span></span>',
    '    </div>',
    '  </div>',
    '  <div class="sr-mod sr-mod--apalanc" title="' + T('hud.apalancTitulo') + '">',
    '    <span class="sr-mod__lbl">' + T('hud.apalanc') + '</span>',
    '    <span class="sr-hud__lev" data-riesgo="0">×1</span>',
    '  </div>',
    '  <div class="sr-mod sr-mod--banca">',
    '    <div class="sr-banca__fila"><span class="sr-mod__lbl">' + T('hud.bote') + '</span><span class="sr-hud__bote">0</span></div>',
    '    <div class="sr-banca__fila"><span class="sr-mod__lbl">' + T('hud.puntos') + '</span><span class="sr-hud__puntos">0</span></div>',
    '  </div>',
    '</div>',
    '<div class="sr-viewport">',
    '  <canvas class="sr-canvas"></canvas>',
    '  <div class="sr-buff-pill sr-hud__buff"></div>',
    '  <div class="sr-overlay sr-modal-levelup" data-visible="0">',
    '    <div class="sr-modal-title">' + T('nivel.titulo') + '</div>',
    '    <div class="sr-modal-subtitle">' + T('nivel.sub') + '</div>',
    '    <div class="sr-cards-grid"></div>',
    '  </div>',
    '  <div class="sr-overlay sr-modal-menu" data-visible="0">',
    '    <div class="sr-menu__holo">' + ico('anillo', 'sr-ico--holo') + '</div>',
    '    <div class="sr-menu" data-panel="principal">',
    '      <div class="sr-menu__title">SNAKE COGUE PITE</div>',
    '      <button type="button" class="sr-btn-restart sr-menu__btn" data-act="jugar">' + ico('jugar') + ' ' + T('menu.jugar') + '</button>',
    '      <button type="button" class="sr-btn-secundario sr-menu__btn" data-act="controles">' + ico('mando') + ' ' + T('menu.controles') + '</button>',
    '      <button type="button" class="sr-btn-secundario sr-menu__btn" data-act="acerca">' + ico('vida') + ' ' + T('menu.acerca') + '</button>',
    '      <button type="button" class="sr-btn-secundario sr-menu__btn sr-menu__idioma" data-act="idioma" data-idioma="' + idioma() + '" title="' + T('menu.idiomaTitulo') + '"><b data-on="es">ES</b><i>·</i><b data-on="en">EN</b></button>',
    '      <div class="sr-menu__record">' + T('menu.record', { pts: 0, cola: 4 }) + '</div>',
    '    </div>',
    '    <div class="sr-menu sr-menu--controles" data-panel="controles" data-visible="0">',
    '      <div class="sr-modal-title">' + T('ctl.titulo') + '</div>',
    '      <dl class="sr-controles">',
    '        <dt><span class="sr-footer__kbd">WASD</span> / <span class="sr-footer__kbd">' + T('ctl.flechas') + '</span></dt><dd>' + T('ctl.mover') + '</dd>',
    '        <dt><span class="sr-footer__kbd">' + T('ctl.espacio') + '</span> / <span class="sr-footer__kbd">Shift</span></dt><dd>' + T('ctl.dash') + '</dd>',
    '        <dt>' + T('ctl.cola') + '</dt><dd>' + T('ctl.colaD') + '</dd>',
    '        <dt>' + T('ctl.sinEnergia') + '</dt><dd>' + T('ctl.sinEnergiaD') + '</dd>',
    '        <dt>' + T('ctl.artefactos') + '</dt><dd>' + T('ctl.artefactosD') + '</dd>',
    '      </dl>',
    '      <div class="sr-modal-title sr-modal-title--menor">' + T('ctl.apuesta') + '</div>',
    '      <dl class="sr-controles sr-controles--apuesta">',
    '        <dt>' + T('ctl.racha') + '</dt><dd>' + T('ctl.rachaD') + '</dd>',
    '        <dt>' + T('ctl.bote') + '</dt><dd>' + T('ctl.boteD') + '</dd>',
    '        <dt><span class="sr-footer__kbd">C</span></dt><dd>' + T('ctl.cobrarD') + '</dd>',
    '        <dt><span class="sr-footer__kbd">1</span>–<span class="sr-footer__kbd">5</span> · <span class="sr-footer__kbd">Q</span>/<span class="sr-footer__kbd">E</span></dt><dd>' + T('ctl.apalancD') + '</dd>',
    '        <dt>' + ico('ficha') + '</dt><dd>' + T('ctl.fichasD') + '</dd>',
    '        <dt><span class="sr-footer__kbd">M</span></dt><dd>' + T('ctl.sonidoD') + '</dd>',
    '        <dt><span class="sr-footer__kbd">L</span></dt><dd>' + T('ctl.idiomaD') + '</dd>',
    '      </dl>',
    '      <button type="button" class="sr-btn-secundario sr-menu__btn" data-act="volver">' + T('menu.volver') + '</button>',
    '    </div>',
    '    <aside class="sr-menu__top">',
    '      <div class="sr-menu__top-titulo">' + ico('trofeo') + ' ' + T('rank.titulo') + '</div>',
    '      <ol class="sr-ranking"></ol>',
    '      <div class="sr-ranking__estado"></div>',
    '    </aside>',
    '    <div class="sr-menu sr-menu--acerca" data-panel="acerca" data-visible="0">',
    '      <div class="sr-modal-title">' + T('acerca.titulo') + '</div>',
    '      <p class="sr-acerca__texto">' + T('acerca.texto') + '</p>',
    '      <p class="sr-acerca__texto sr-acerca__texto--menor">' + T('acerca.texto2', { link: '<a class="sr-acerca__enlace" href="' + ENLACE_GITHUB + '" target="_blank" rel="noopener">github.com/MrPretendo/snake-cogue-pite</a>' }) + '</p>',
    '      <p class="sr-acerca__texto sr-acerca__creditos">' + T('acerca.creditos') + '</p>',
    '      <a class="sr-btn-restart sr-menu__btn sr-acerca__patreon" href="' + ENLACE_PATREON + '" target="_blank" rel="noopener">' + ico('vida') + ' ' + T('acerca.patreon') + '</a>',
    '      <button type="button" class="sr-btn-secundario sr-menu__btn" data-act="volver">' + T('menu.volver') + '</button>',
    '    </div>',
    '    <a class="sr-patreon" href="' + ENLACE_PATREON + '" target="_blank" rel="noopener">',
    '      <span class="sr-patreon__icono">' + ico('vida') + '</span>',
    '      <span class="sr-patreon__texto">' + T('patreon.holo') + '</span>',
    '    </a>',
    '  </div>',
    '  <div class="sr-overlay sr-modal-tragaperras" data-visible="0">',
    '    <div class="sr-modal-title">' + ico('ficha') + ' ' + T('slot.titulo') + '</div>',
    '    <div class="sr-modal-subtitle">' + T('slot.sub') + '</div>',
    '    <div class="sr-rodillos">',
    '      <div class="sr-rodillo" data-parado="0">' + ico('escudo', 'sr-ico--rodillo') + '</div>',
    '      <div class="sr-rodillo" data-parado="0">' + ico('rayo', 'sr-ico--rodillo') + '</div>',
    '      <div class="sr-rodillo" data-parado="0">' + ico('iman', 'sr-ico--rodillo') + '</div>',
    '    </div>',
    '    <div class="sr-tragaperras__resultado"></div>',
    '  </div>',
    '  <div class="sr-overlay sr-modal-mecanica" data-visible="0">',
    '    <div class="sr-modal-title">' + T('sel.titulo') + '</div>',
    '    <div class="sr-modal-subtitle">' + T('sel.sub') + '</div>',
    '    <div class="sr-cards-grid sr-cards-grid--mecanicas"></div>',
    '    <div class="sr-seleccion__botones">',
    '      <button type="button" class="sr-btn-secundario sr-btn-rebobinar" data-act="menu">' + ico('cerrar') + ' ' + T('sel.atras') + ' <span class="sr-footer__kbd">Esc</span></button>',
    '      <button type="button" class="sr-btn-secundario sr-btn-rebobinar" data-act="rebobinar">' + ico('dados') + ' ' + T('sel.rebobinar') + ' <span class="sr-footer__kbd">R</span></button>',
    '    </div>',
    '  </div>',
    '  <div class="sr-overlay sr-modal-summary" data-visible="0">',
    '    <div class="sr-summary-box">',
    '      <div class="sr-summary-title">' + T('fin.titulo') + '</div>',
    '      <div class="sr-summary-puntos"><span class="sr-stat-puntos">0</span> ' + T('fin.puntos') + '</div>',
    '      <div class="sr-summary-rank"></div>',
    '      <div class="sr-summary-stats">',
    '        <div class="sr-stat-item"><span class="sr-stat-val sr-stat-length">0</span><span class="sr-stat-lbl">' + T('fin.colaMax') + '</span></div>',
    '        <div class="sr-stat-item"><span class="sr-stat-val sr-stat-fruits">0</span><span class="sr-stat-lbl">' + T('fin.frutas') + '</span></div>',
    '        <div class="sr-stat-item"><span class="sr-stat-val sr-stat-vaults">0</span><span class="sr-stat-lbl">' + T('fin.saltos') + '</span></div>',
    '        <div class="sr-stat-item"><span class="sr-stat-val sr-stat-jackpot">0</span><span class="sr-stat-lbl">' + T('fin.tiradas') + '</span></div>',
    '        <div class="sr-stat-item"><span class="sr-stat-val sr-stat-racha">0</span><span class="sr-stat-lbl">' + T('fin.rachaMax') + '</span></div>',
    '        <div class="sr-stat-item"><span class="sr-stat-val sr-stat-time">0s</span><span class="sr-stat-lbl">' + T('fin.tiempo') + '</span></div>',
    '      </div>',
    '      <div class="sr-summary-bote"></div>',
    '      <form class="sr-summary-ranking" data-act="form-ranking">',
    '        <input class="sr-summary-nombre" type="text" maxlength="12" placeholder="' + T('rank.nombre') + '" autocomplete="off" spellcheck="false">',
    '        <button type="submit" class="sr-btn-secundario sr-summary-enviar">' + ico('trofeo') + ' ' + T('rank.enviar') + '</button>',
    '        <span class="sr-summary-ranking__estado"></span>',
    '      </form>',
    '      <div class="sr-summary-botones">',
    '        <button type="button" class="sr-btn-restart" data-act="restart">' + T('fin.otra') + '</button>',
    '        <button type="button" class="sr-btn-secundario" data-act="menu">' + T('fin.menu') + '</button>',
    '      </div>',
    '    </div>',
    '  </div>',
    '</div>',
    '<div class="sr-footer">',
    '  <div class="sr-footer__hint">',
    '    <span>' + T('pie.mover') + ' <span class="sr-footer__kbd">WASD</span>/<span class="sr-footer__kbd">' + T('pie.flechas') + '</span></span>',
    '    <span>' + T('pie.turbo') + ' <span class="sr-footer__kbd">' + T('pie.espacio') + '</span></span>',
    '    <span>' + T('pie.apalancar') + ' <span class="sr-footer__kbd">1</span>-<span class="sr-footer__kbd">5</span> <span class="sr-footer__kbd">Q</span>/<span class="sr-footer__kbd">E</span></span>',
    '    <span>' + T('pie.cobrar') + ' <span class="sr-footer__kbd">C</span></span>',
    '    <span><em>' + T('pie.cruzar') + '</em></span>',
    '  </div>',
    '  <span class="sr-footer__derecha">',
    '    <span class="sr-footer__record"><span class="sr-footer__mecanica">' + T('sel.clasica') + '</span> · ' + T('pie.record', { pts: 0, cola: 4 }) + '</span>',
    '    <button type="button" class="sr-footer__sonido" data-act="sonido" title="' + T('pie.sonido') + '">' + ico('sonido') + '</button>',
    '  </span>',
    '</div>'
  ].join('\n');
}

// Pinta el DOM y enlaza los elementos. Se llama al montar y al cambiar de idioma.
function construirUI() {
  const root = inst.root;
  root.innerHTML = marcadoUI();
  inyectarSprite(root);

  const q = (s) => root.querySelector(s);
  inst.els = {
    energyBar: q('.sr-hud__energy-bar'),
    energyText: q('.sr-hud__energy-text'),
    drainText: q('.sr-hud__drain'),
    xpBar: q('.sr-hud__xp-bar'),
    xpText: q('.sr-hud__xp-text'),
    xpLevelText: q('.sr-hud__xp'),
    lengthText: q('.sr-hud__length'),
    scoreText: q('.sr-hud__score'),
    viewport: q('.sr-viewport'),
    canvas: q('.sr-canvas'),
    modalLevelup: q('.sr-modal-levelup'),
    cardsGrid: q('.sr-cards-grid'),
    modalSummary: q('.sr-modal-summary'),
    summaryTitle: q('.sr-summary-title'),
    summaryRank: q('.sr-summary-rank'),
    statLength: q('.sr-stat-length'),
    statFruits: q('.sr-stat-fruits'),
    statVaults: q('.sr-stat-vaults'),
    statTime: q('.sr-stat-time'),
    btnRestart: q('.sr-btn-restart'),
    footerRecord: q('.sr-footer__record'),
    rachaText: q('.sr-hud__racha-text'),
    rachaBar: q('.sr-hud__racha-bar'),
    frenesiBar: q('.sr-hud__frenesi-bar'),
    frenesiText: q('.sr-hud__frenesi-text'),
    lev: q('.sr-hud__lev'),
    bote: q('.sr-hud__bote'),
    puntos: q('.sr-hud__puntos'),
    statPuntos: q('.sr-stat-puntos'),
    statJackpot: q('.sr-stat-jackpot'),
    fichas: q('.sr-hud__fichas-n'),
    hud: q('.sr-hud'),
    menuHolo: q('.sr-menu__holo'),
    botonSonido: q('.sr-footer__sonido'),
    buff: q('.sr-hud__buff'),
    modalTragaperras: q('.sr-modal-tragaperras'),
    rodillos: Array.from(root.querySelectorAll('.sr-rodillo')),
    tragaperrasResultado: q('.sr-tragaperras__resultado'),
    statRacha: q('.sr-stat-racha'),
    summaryBote: q('.sr-summary-bote'),
    modalMenu: q('.sr-modal-menu'),
    menuPrincipal: q('.sr-menu[data-panel="principal"]'),
    menuControles: q('.sr-menu[data-panel="controles"]'),
    menuAcerca: q('.sr-menu[data-panel="acerca"]'),
    rankingLista: q('.sr-ranking'),
    rankingEstado: q('.sr-ranking__estado'),
    formRanking: q('.sr-summary-ranking'),
    nombreRanking: q('.sr-summary-nombre'),
    enviarRanking: q('.sr-summary-enviar'),
    estadoEnvio: q('.sr-summary-ranking__estado'),
    menuRecord: q('.sr-menu__record'),
    modalMecanica: q('.sr-modal-mecanica'),
    mecanicasGrid: q('.sr-cards-grid--mecanicas'),
    footerMecanica: q('.sr-footer__mecanica')
  };

  inst.canvas = inst.els.canvas;
  inst.ctx2d = inst.canvas.getContext('2d');

  if (inst.ro) inst.ro.disconnect();
  inst.ro = new ResizeObserver(onResize);
  inst.ro.observe(inst.els.viewport);

  inst.els.formRanking.addEventListener('submit', enviarPuntuacion);

  if (inst.els.botonSonido && sfx.estaSilenciado()) {
    inst.els.botonSonido.innerHTML = ico('silencio');
    inst.els.botonSonido.dataset.silenciado = '1';
  }
}

// Cambio de idioma: solo en el menu o en la seleccion, donde no hay partida a medias.
function alternarIdiomaUI() {
  const g = inst.game;
  if (!g || (g.state !== 'menu' && g.state !== 'seleccion')) return;
  alternarIdioma();
  const panel = inst.els.menuControles ? panelActual() : 'principal';
  construirUI();
  medirViewport();
  updateGridDimensions();
  // El nombre de la mecanica se compuso en el idioma anterior: rehacerlo
  if (g.mecanica && g.mecanica.lista) g.mecanica = fusionarMecanicas(g.mecanica.lista);
  if (g.state === 'menu') {
    mostrarMenu();
    mostrarPanel(panel);
  } else {
    pintarOferta();
  }
  sfx.tocar('clic');
}

export async function mount({ win, root, os, t }) {
  inst = {
    win, root, os, t,
    tick: null, gen: 0,
    canvas: null, ctx2d: null,
    ro: null,
    els: {},
    game: null
  };

  win.setTitle(t('TITULO_APP'));
  root.classList.add('sr-app');

  construirUI();

  // Soundtrack: un bucle junto al modulo; arranca con el primer gesto.
  musica.cargar(new URL('./musica/snake_cogue_pite.mp3', import.meta.url).href);

  initGame();
  mostrarMenu();

  root.addEventListener('click', onClick);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  thaw();
}

export function activate() {}

export function freeze() {
  if (inst && inst.tick) {
    clearTimeout(inst.tick);
    inst.tick = null;
  }
  musica.pausar();
}

export function thaw() {
  if (!inst || inst.tick) return;
  musica.reanudar();
  const gen = ++inst.gen;
  const loop = () => {
    if (!inst || inst.gen !== gen) return;
    inst.tick = null;
    gameTick();
    inst.tick = setTimeout(loop, TICK_MS);
  };
  inst.tick = setTimeout(loop, TICK_MS);
}

export function unmount() {
  if (!inst) return;
  freeze();
  if (inst.ro) inst.ro.disconnect();
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  sfx.cerrar();
  musica.cerrar();
  inst.root.innerHTML = '';
  inst.root.classList.remove('sr-app');
  inst = null;
}

// ---- inicialización del juego ---------------------------------------------

function initGame(listaMecanicas = []) {
  const mecanica = fusionarMecanicas(listaMecanicas);
  const g = {
    state: 'playing', // 'seleccion', 'playing', 'level_up', 'game_over'
    mecanica,
    vidasExtra: mecanica.vidasExtra,
    muroLibre: Math.floor(Math.random() * 4),
    muroTimer: MURO_CADENCIA,
    gridCols: 36,
    gridRows: 24,
    tile: GRID_SIZE,
    stepTimer: 0,
    baseStepInterval: 0.125 / mecanica.velocidad, // ~8 movimientos por segundo base
    stepInterval: 0.125 / mecanica.velocidad,
    snake: [
      { x: 10, y: 12, jump: 0 },
      { x: 9, y: 12, jump: 0 },
      { x: 8, y: 12, jump: 0 },
      { x: 7, y: 12, jump: 0 }
    ],
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    dirQueue: [],
    dashing: false,
    dashMultiplier: 1.6,
    energy: 100,
    maxEnergy: 100,
    inanicion: 0,          // s desde que la energia llego a 0 (0 = no esta ardiendo)
    inanicionAcum: 0,      // fraccion de segmento pendiente de quemar
    inanicionPerdidos: 0,  // segmentos quemados en este episodio
    inanicionLatido: 0,    // ultimo intervalo en que sono el latido
    artefactos: [],
    artefactoTimer: ARTEFACTO_CADENCIA_MIN,
    impulso: 0,            // s de impulso de velocidad restantes
    barrido: 0,            // s de barrido magnetico restantes
    artefactosRecogidos: 0,
    level: 1,
    xp: 0,
    xpNext: calculateXpNext(1),
    fruitsEaten: 0,
    maxTailAchieved: 4,
    vaultCount: 0,
    freeVaults: 0,
    activePerks: new Set(),
    perkStacks: new Map(),
    fruits: [],
    particles: [],
    floaters: [],
    cameraShake: 0,
    runTime: 0,
    compassAngle: 0,
    // bucle de apuesta
    racha: 0,
    rachaTimer: 0,
    rachaVentana: RACHA_VENTANA_MAX,
    rachaMax: 0,
    frenesi: 0,
    frenesiActiva: false,
    frenesiTimer: 0,
    frenesis: 0,
    bajonTimer: 0,
    apalancamiento: mecanica.apalancamientoMin || 1,
    nivelTimer: NIVEL_ENFRIAMIENTO, // arranca fuera del enfriamiento
    apalancamientoMax: NIVELES_APALANCAMIENTO[NIVELES_APALANCAMIENTO.length - 1],
    bote: 0,
    puntos: 0,
    mayorJackpot: 0,       // mayor cobro por triple
    jackpotFichas: 0,
    tiradas: 0,
    triples: 0,
    ultimaTiradaNada: false,
    tragaperras: null,     // { t, simbolos, tipo, premio, mostrado }
    buff: null,            // id de TRAGAPERRAS_SIMBOLOS activo
    buffTimer: 0,
    // efectos
    tiempo: 0,             // reloj de animacion (corre en todos los estados)
    ondas: [],
    flash: null,
    rastro: [],
    monedas: [],
    hitStop: 0,            // s de congelacion de la simulacion (impacto)
    muerteTimer: 0,
    muerteRazon: '',
    puntosPop: 0,
    botePop: 0,
    cobros: 0,
    // tamano de la arena: se mide del viewport real (antes quedaba fijo en
    // 800x500 y al reiniciar la arena encogia dentro del canvas)
    w: 800,
    h: 500
  };

  inst.game = g;
  medirViewport();
  updateGridDimensions();
  spawnInitialFruits();
  updateHUD();
}

function medirViewport() {
  const g = inst.game;
  const vp = inst.els.viewport;
  if (!g || !vp) return;
  const r = vp.getBoundingClientRect();
  // El ResizeObserver solo avisa cuando el elemento CAMBIA de tamano: al
  // reiniciar la run no cambia, asi que hay que medir a mano.
  if (r.width >= 50 && r.height >= 50) {
    g.w = Math.round(r.width);
    g.h = Math.round(r.height);
    if (inst.canvas && (inst.canvas.width !== g.w || inst.canvas.height !== g.h)) {
      inst.canvas.width = g.w;
      inst.canvas.height = g.h;
    }
  }
}

function updateGridDimensions() {
  const g = inst.game;
  if (!g) return;
  g.gridCols = Math.max(20, Math.floor(g.w / g.tile));
  g.gridRows = Math.max(16, Math.floor(g.h / g.tile));
}

function onResize(entries) {
  if (!inst || !inst.canvas) return;
  const { width, height } = entries[0].contentRect;
  if (width < 50 || height < 50) return;

  inst.canvas.width = Math.round(width);
  inst.canvas.height = Math.round(height);

  const g = inst.game;
  if (g) {
    g.w = Math.round(width);
    g.h = Math.round(height);
    updateGridDimensions();
  }
}

// ---- spawn dinámico de frutas (progresivamente más lejanas) -----------------

function spawnInitialFruits() {
  const g = inst.game;
  g.fruits = [];
  const twinStacks = (g.perkStacks && g.perkStacks.get('twin_fruits')) || (g.activePerks.has('twin_fruits') ? 1 : 0);
  const targetCount = twinStacks > 0 ? (1 + 2 * twinStacks) : 1;
  rellenarFrutas(targetCount);
}

// Acotado a proposito: spawnFruit() no crea nada si el tablero esta lleno, y un
// `while` sin tope se quedaba girando para siempre.
function rellenarFrutas(objetivo) {
  const g = inst.game;
  if (!g) return;
  for (let i = 0; i < 64 && g.fruits.length < objetivo; i++) {
    const antes = g.fruits.length;
    spawnFruit();
    if (g.fruits.length === antes) break;
  }
}

function spawnFruit(forcedType = null) {
  const g = inst.game;
  if (!g) return;

  const head = g.snake[0];
  const tailLen = g.snake.length;

  // Distancia mínima escalada con la longitud de la cola:
  // A mayor cola, la fruta aparece a distancias mucho más extremas y lejanas
  let minTileDist = Math.min(
    Math.floor(Math.hypot(g.gridCols, g.gridRows) * 0.75),
    4 + Math.floor(tailLen * 0.45)
  );
  // En frenesí las frutas caen cerca: el frenesi es encadenarlas, no cruzar la arena.
  if (g.frenesiActiva) minTileDist = Math.max(2, Math.floor(minTileDist * 0.5));
  // Pero NUNCA dentro del alcance del iman: una fruta que nace en el radio de
  // absorcion es comida gratis sin moverse, y con Frutas Multiples eso era un
  // aspirador infinito (medido: 7207 frutas en 37 s).
  const rangoIman = Math.min(alcanceIman(g), IMAN_CARTA_TOPE);
  if (rangoIman > 0) {
    minTileDist = Math.max(minTileDist, Math.ceil(rangoIman + 1.5));
  }

  const occupied = new Set();
  for (const s of g.snake) {
    occupied.add(`${s.x},${s.y}`);
  }
  for (const f of g.fruits) {
    occupied.add(`${Math.round(f.x)},${Math.round(f.y)}`);
  }
  for (const a of g.artefactos) occupied.add(`${a.x},${a.y}`);

  const farCandidates = [];
  const allFreeCandidates = [];

  for (let x = 1; x < g.gridCols - 1; x++) {
    for (let y = 1; y < g.gridRows - 1; y++) {
      const key = `${x},${y}`;
      if (occupied.has(key)) continue;

      const dist = Math.hypot(x - head.x, y - head.y);
      allFreeCandidates.push({ x, y, dist });
      if (dist >= minTileDist) {
        farCandidates.push({ x, y, dist });
      }
    }
  }

  const pool = farCandidates.length > 0 ? farCandidates : allFreeCandidates;
  if (pool.length === 0) return;

  // Entre más larga la cola, se escoge de los candidatos con mayor distancia
  pool.sort((a, b) => b.dist - a.dist);
  const topSlice = pool.slice(0, Math.max(3, Math.floor(pool.length * 0.35)));
  const chosen = topSlice[Math.floor(Math.random() * topSlice.length)];

  // Tipo de fruta
  let type = forcedType || 'normal';
  if (!forcedType) {
    const r = Math.random();
    if (r < 0.10) {
      type = 'mutant'; // Fruta dorada que otorga mutación / sobrecarga
    } else if (r < 0.30) {
      type = 'phase'; // Cristal violeta que otorga saltos de cola gratuitos
    } else if (r < 0.52) {
      type = 'hyper'; // Fruta roja de velocidad y sobrealimentación
    } else {
      type = 'normal'; // Fruta verde estándar
    }
  }

  g.fruits.push({
    x: chosen.x,
    y: chosen.y,
    type,
    pulse: 0,
    birthTime: g.runTime
  });
}

// ---- loop de simulación ---------------------------------------------------

function gameTick() {
  if (!inst || !inst.game) return;
  const g = inst.game;

  const dt = TICK_MS / 1000;
  g.tiempo += dt;

  // Soundtrack: presente en el frenesí, discreto en el menú, casi nada al morir
  musica.nivel(
    g.state === 'menu' || g.state === 'seleccion' ? 0.24
      : g.state === 'muriendo' || g.state === 'game_over' ? 0.12
      : g.frenesiActiva ? 0.5
      : g.state === 'tragaperras' ? 0.3
      : 0.36
  );
  musica.tick(dt);

  // Hit-stop: la simulacion se congela un instante; los efectos siguen
  if (g.hitStop > 0) g.hitStop = Math.max(0, g.hitStop - dt);

  // Muriendo: el holograma se rompe antes de mostrar el resumen
  if (g.state === 'muriendo') {
    g.muerteTimer -= dt;
    g.cameraShake = Math.max(g.cameraShake, 6 + 8 * Math.max(0, g.muerteTimer));
    if (g.muerteTimer <= 0) gameOver(g.muerteRazon);
  }

  if (g.state === 'playing' && g.hitStop <= 0) {
    g.runTime += dt;

    // 1. Gasto metabolico (misma formula que muestra el HUD: calcularGasto)
    const tailLen = g.snake.length;
    const turboStacks = stacksDe(g, 'turbo_efficient');
    const cosmicStacks = stacksDe(g, 'cosmic_resonance');
    const compassStacks = stacksDe(g, 'hyperspace_compass');
    let totalDrain = calcularGasto(g);

    if (g.dashing && !g.mecanica.turboGratis) {
      totalDrain += turboStacks > 0 ? Math.max(1.5, 3.4 / turboStacks) : 17;
    }

    // El frenesí suspende el gasto entero, turbo incluido
    // El paro del metabolismo es EXCLUSIVO de la tragaperras (buff Sin Gasto);
    // el frenesí solo lo reduce a la mitad.
    if (g.buff === 'energia' || g.impulso > 0) totalDrain = 0;
    else if (g.frenesiActiva) totalDrain *= 0.5;
    if (g.buff === 'lento') totalDrain *= 0.5;

    g.energy = Math.max(0, g.energy - totalDrain * dt);

    // Si la energía se agota: hambre crítica que autocanibaliza la cola...
    // salvo con apalancamiento alto, donde no hay gracia: LIQUIDACION.
    // Invencible: la energia no puede matarte
    if (g.buff === 'escudo') g.energy = Math.max(g.energy, 1);

    if (g.energy <= 0 && g.apalancamiento >= LIQUIDACION_DESDE) {
      if (usarSegundaVida()) {
        g.energy = g.maxEnergy * 0.5;
      } else {
        spawnParticleBurst((g.snake[0].x + 0.5) * g.tile, (g.snake[0].y + 0.5) * g.tile, '#FF1744', 40);
        morir(T('muerte.liquidado', { n: g.apalancamiento }));
        return;
      }
    }
    if (g.energy <= 0) {
      const head = g.snake[0];
      const hx = (head.x + 0.5) * g.tile;
      const hy = (head.y + 0.5) * g.tile;
      if (g.inanicion <= 0) {
        g.inanicion = 0.0001;
        g.inanicionAcum = 0;
        g.inanicionPerdidos = 0;
        g.inanicionLatido = -1;
        addFloater(T('f.sinEnergia'), g.w / 2, g.h / 3, '#FF1744', { tam: 18, glow: 16, dur: 1.4 });
        sfx.tocar('hambre');
        fx.flash(g, fx.ROJO, 0.35, 0.4);
        fx.onda(g, hx, hy, { maxR: 200, dur: 0.6, color: fx.ROJO, grosor: 4 });
        g.cameraShake = Math.max(g.cameraShake, 6);
      }
      g.inanicion += dt;

      // Velocidad de quema: la cola maxima de la run, no la actual
      const segPorSeg = Math.max(INANICION_MIN_SEG_S, g.maxTailAchieved / INANICION_SEGUNDOS_AL_PICO);

      // Latido: mas rapido cuanto menos cola queda
      const fraccion = Math.max(0, (g.snake.length - COLA_MINIMA) / Math.max(1, g.maxTailAchieved - COLA_MINIMA));
      const paso = fraccion > 0.5 ? 0.4 : fraccion > 0.2 ? 0.25 : 0.15;
      const marca = Math.floor(g.inanicion / paso);
      if (marca !== g.inanicionLatido) {
        g.inanicionLatido = marca;
        sfx.tocar('latido', { urgencia: 1 - fraccion });
      }

      if (g.inanicion >= INANICION_GRACIA) {
        g.inanicionAcum += segPorSeg * dt;
        while (g.inanicionAcum >= 1) {
          g.inanicionAcum -= 1;
          if (g.snake.length > COLA_MINIMA) {
            const dropped = g.snake.pop();
            g.inanicionPerdidos++;
            if (g.inanicionPerdidos % 2 === 1) {
              spawnParticleBurst((dropped.x + 0.5) * g.tile, (dropped.y + 0.5) * g.tile, '#FF1744', 5);
            }
          } else if (usarSegundaVida()) {
            g.energy = g.maxEnergy * 0.5;
            g.inanicion = 0;
            g.inanicionAcum = 0;
            break;
          } else {
            spawnParticleBurst(hx, hy, '#FF1744', 40);
            morir(T('muerte.inanicion'));
            return;
          }
        }
      }
    } else if (g.inanicion > 0) {
      // Comio a tiempo. La cola que regenere arde igual de rapido: el pico no baja.
      const aviso = g.inanicionPerdidos > 0 ? T('f.aTiempoCola', { n: g.inanicionPerdidos }) : T('f.aTiempo');
      addFloater(aviso, (g.snake[0].x + 0.5) * g.tile, (g.snake[0].y + 0.5) * g.tile - 30, '#00E676', { tam: 14, glow: 12 });
      fx.flash(g, fx.VERDE, 0.18, 0.3);
      g.inanicion = 0;
      g.inanicionAcum = 0;
      g.inanicionPerdidos = 0;
    }

    // 1b. Racha, frenesí y bajon; reloj del enfriamiento de nivel; mejora temporal
    g.nivelTimer += dt;
    actualizarApuesta(dt);
    if (g.state !== 'playing') return;
    if (g.buff) {
      g.buffTimer -= dt;
      if (g.buffTimer <= 0) {
        addFloater(T('f.finBuff', { n: nombreSimbolo(simboloDe(g.buff)) }), g.w / 2, g.h / 3, '#94A3B8');
        sfx.tocar('buffFin');
        g.buff = null;
        g.buffTimer = 0;
      }
    }

    // 1c-0. Artefactos: aparecen, caducan; impulso y barrido corren
    g.artefactoTimer -= dt;
    if (g.artefactoTimer <= 0) {
      spawnArtefacto();
      g.artefactoTimer = ARTEFACTO_CADENCIA_MIN + Math.random() * (ARTEFACTO_CADENCIA_MAX - ARTEFACTO_CADENCIA_MIN);
    }
    for (let i = g.artefactos.length - 1; i >= 0; i--) {
      const a = g.artefactos[i];
      a.vida -= dt;
      if (a.vida <= 0) {
        g.artefactos.splice(i, 1);
        spawnParticleBurst((a.x + 0.5) * g.tile, (a.y + 0.5) * g.tile, colorArtefacto(a.tipo), 8);
      }
    }
    if (g.impulso > 0) g.impulso = Math.max(0, g.impulso - dt);
    if (g.barrido > 0) {
      g.barrido = Math.max(0, g.barrido - dt);
      const head = g.snake[0];
      for (let i = g.fruits.length - 1; i >= 0; i--) {
        const f = g.fruits[i];
        const d = Math.hypot(head.x - f.x, head.y - f.y);
        if (d <= 1.3) {
          const fruit = g.fruits.splice(i, 1)[0];
          onEatFruit(fruit, true);
          if (g.state !== 'playing') break;
          continue;
        }
        const paso = Math.min(d, BARRIDO_TIRON);
        f.x += ((head.x - f.x) / d) * paso;
        f.y += ((head.y - f.y) / d) * paso;
      }
    }

    // 1c. Mecanicas de atencion: el muro que salta y las frutas que caducan
    if (g.mecanica.muroErrante) {
      const antes = g.muroTimer;
      g.muroTimer -= dt;
      if (antes > MURO_AVISO && g.muroTimer <= MURO_AVISO) {
        addFloater(T('f.muroAviso'), g.w / 2, g.h / 3, '#FFD54F');
        sfx.tocar('muroAviso');
      }
      if (g.muroTimer <= 0) {
        g.muroTimer = MURO_CADENCIA;
        const otros = [0, 1, 2, 3].filter((i) => i !== g.muroLibre);
        g.muroLibre = otros[Math.floor(Math.random() * otros.length)];
        addFloater(T('f.muroLibre', { m: T('muro.' + g.muroLibre) }), g.w / 2, g.h / 3, '#00E5FF');
        sfx.tocar('muroSalto');
        fx.flash(g, fx.CIAN, 0.18, 0.25);
      }
    }
    if (g.mecanica.frutasFugaces) {
      for (let i = g.fruits.length - 1; i >= 0; i--) {
        const f = g.fruits[i];
        if (g.runTime - f.birthTime >= g.mecanica.frutasFugaces) {
          g.fruits.splice(i, 1);
          spawnParticleBurst((f.x + 0.5) * g.tile, (f.y + 0.5) * g.tile, '#94A3B8', 10);
          if (g.racha > 0) {
            addFloater(T('f.frutaPerdidaRacha', { m: multiplicadorRacha(g.racha).toFixed(2) }), (f.x + 0.5) * g.tile, (f.y + 0.5) * g.tile - 16, '#FF5252');
            g.racha = 0;
            g.rachaTimer = 0;
            sfx.tocar('rachaRota');
          } else {
            addFloater(T('f.frutaPerdida'), (f.x + 0.5) * g.tile, (f.y + 0.5) * g.tile - 16, '#94A3B8');
            sfx.tocar('frutaPerdida');
          }
        }
      }
      const twin = stacksDe(g, 'twin_fruits');
      rellenarFrutas(twin > 0 ? (1 + 2 * twin) : 1);
    }

    // 2. Control de velocidad de paso
    let currentStepInt = g.baseStepInterval;
    if (g.dashing) {
      const dashFactor = turboStacks > 0 ? (g.dashMultiplier * 1.25) : g.dashMultiplier;
      currentStepInt /= dashFactor;
    }
    if (compassStacks > 0) {
      currentStepInt *= Math.pow(0.74, compassStacks); // +35% move speed
    }
    if (cosmicStacks > 0) {
      const tiers = Math.floor(tailLen / 10);
      if (tiers > 0) {
        currentStepInt *= Math.pow(0.89, tiers * cosmicStacks); // +12% velocidad por cada 10 casillas
      }
    }
    // El apalancamiento tambien acelera un poco: mas riesgo, mas ritmo
    currentStepInt /= 1 + VELOCIDAD_POR_APALANCAMIENTO * (g.apalancamiento - 1);
    if (g.buff === 'lento') currentStepInt *= 1.5;
    if (g.impulso > 0) currentStepInt /= 1 + IMPULSO_VELOCIDAD * (g.impulso / IMPULSO_DURACION);
    if (g.frenesiActiva) currentStepInt *= 0.77;      // +30% en frenesí
    else if (g.bajonTimer > 0) currentStepInt *= 1.1;  // -10% en el bajon
    g.stepInterval = currentStepInt;

    g.stepTimer += dt;
    if (g.stepTimer >= g.stepInterval) {
      g.stepTimer = 0;
      stepSnake();
    }

    // 3. Imán cuántico de frutas: atracción y absorción con alcance decreciente
    const magnetRange = alcanceIman(g);
    if (magnetRange > 0) {
      const head = g.snake[0];
      const neck = g.snake[1] || head;

      for (let i = g.fruits.length - 1; i >= 0; i--) {
        const f = g.fruits[i];
        const distHead = Math.hypot(head.x - f.x, head.y - f.y);
        const distNeck = Math.hypot(neck.x - f.x, neck.y - f.y);

        // Si la fruta está a distancia de absorción (cabeza o cuello tras girar/avanzar)
        if (distHead <= 1.3 || distNeck <= 1.15) {
          const fruit = g.fruits.splice(i, 1)[0];
          onEatFruit(fruit, true);
          addFloater(T('f.absorcion'), (head.x + 0.5) * g.tile, (head.y + 0.5) * g.tile - 16, '#00E5FF');
          spawnParticleBurst((head.x + 0.5) * g.tile, (head.y + 0.5) * g.tile, '#00E5FF', 14);
          if (g.state !== 'playing') break;
          continue;
        }

        if (distHead <= magnetRange) {
          // Tirón medido y progresivo
          const pullSpeed = g.buff === 'iman'
            ? Math.min(distHead, IMAN_TOTAL_TIRON)
            : Math.min(distHead, 0.55 + (magnetRange - distHead) * 0.25);
          const dx = head.x - f.x;
          const dy = head.y - f.y;
          f.x += (dx / distHead) * pullSpeed;
          f.y += (dy / distHead) * pullSpeed;

          // Si tras el tirón ya llegó al alcance de absorción, devorarla en este mismo tick
          const newDist = Math.hypot(head.x - f.x, head.y - f.y);
          if (newDist <= 1.3) {
            const fruit = g.fruits.splice(i, 1)[0];
            onEatFruit(fruit, true);
          addFloater(T('f.absorcion'), (head.x + 0.5) * g.tile, (head.y + 0.5) * g.tile - 16, '#00E5FF');
            spawnParticleBurst((head.x + 0.5) * g.tile, (head.y + 0.5) * g.tile, '#00E5FF', 14);
            if (g.state !== 'playing') break;
            continue;
          }

          if (Math.random() < 0.35) {
            spawnParticleBurst((f.x + 0.5) * g.tile, (f.y + 0.5) * g.tile, '#00E5FF', 2);
          }
        }
      }
    }

    // 4. Brújula hacia la fruta más lejana/relevante
    updateCompass();
  }

  if (g.state === 'tragaperras') actualizarTragaperras(dt);

  // Actualización de efectos visuales y partículas
  updateParticles(dt);
  updateFloaters(dt);
  fx.actualizarOndas(g, dt);
  fx.actualizarFlash(g, dt);
  fx.actualizarRastro(g, dt);
  const monedasLlegadas = fx.actualizarMonedas(g, dt);
  if (monedasLlegadas > 0) { g.puntosPop = 1; sfx.tocar('clic'); }
  if (g.puntosPop > 0) g.puntosPop = Math.max(0, g.puntosPop - dt * 5);
  if (g.botePop > 0) g.botePop = Math.max(0, g.botePop - dt * 5);

  if (g.cameraShake > 0) {
    g.cameraShake = Math.max(0, g.cameraShake - dt * 18);
  }

  updateHUD();
  render();
}

function updateCompass() {
  const g = inst.game;
  if (!g || g.fruits.length === 0) return;
  const head = g.snake[0];
  const targetFruit = g.fruits[0];
  const dx = (targetFruit.x - head.x);
  const dy = (targetFruit.y - head.y);
  g.compassAngle = Math.atan2(dy, dx);
}

// ---- avance de la serpiente y mecánica de salto de cola -------------------

function stepSnake() {
  const g = inst.game;
  if (g.state !== 'playing') return;

  // Aplicar dirección del buffer
  if (g.dirQueue.length > 0) {
    g.dir = g.dirQueue.shift();
  } else if (g.nextDir) {
    g.dir = g.nextDir;
  }

  const head = g.snake[0];
  let nextX = head.x + g.dir.x;
  let nextY = head.y + g.dir.y;

  // Muros: con Muros de Acero los cuatro matan; con Muro Errante matan tres y
  // el libre (g.muroLibre) envuelve. Segunda Vida perdona el golpe y envuelve.
  const muroCruzado = nextY < 0 ? 0 : nextX >= g.gridCols ? 1 : nextY >= g.gridRows ? 2 : nextX < 0 ? 3 : -1;
  if (muroCruzado !== -1 && g.buff !== 'escudo' && (g.mecanica.muros || (g.mecanica.muroErrante && muroCruzado !== g.muroLibre))) {
    if (!usarSegundaVida()) {
      spawnParticleBurst((head.x + 0.5) * g.tile, (head.y + 0.5) * g.tile, '#FF1744', 32);
      morir(T('muerte.muro'));
      return;
    }
  }

  // Bordes toroidales o límites de la arena
  if (nextX < 0) nextX = g.gridCols - 1;
  else if (nextX >= g.gridCols) nextX = 0;
  if (nextY < 0) nextY = g.gridRows - 1;
  else if (nextY >= g.gridRows) nextY = 0;

  // Comprobar colisión con la propia cola
  let hitSegmentIndex = -1;
  for (let i = 1; i < g.snake.length; i++) {
    if (g.snake[i].x === nextX && g.snake[i].y === nextY) {
      hitSegmentIndex = i;
      break;
    }
  }

  let jumped = false;
  if (hitSegmentIndex !== -1 && g.mecanica.colaIntocable) {
    // Mecanica superior: Cola Intocable. Ni salto, ni escudo, ni frenesí.
    // Solo el buff Invencible o Segunda Vida (una vez) lo perdonan.
    if (g.buff === 'escudo' || usarSegundaVida()) {
      jumped = true;
    } else {
      spawnParticleBurst((nextX + 0.5) * g.tile, (nextY + 0.5) * g.tile, '#FF1744', 32);
      morir(T('muerte.cola'));
      return;
    }
  } else if (hitSegmentIndex !== -1) {
    const turboStacks = (g.perkStacks && g.perkStacks.get('turbo_efficient')) || (g.activePerks.has('turbo_efficient') ? 1 : 0);
    const phantomStacks = (g.perkStacks && g.perkStacks.get('phantom_vault')) || (g.activePerks.has('phantom_vault') ? 1 : 0);
    const elasticStacks = (g.perkStacks && g.perkStacks.get('elastic_body')) || (g.activePerks.has('elastic_body') ? 1 : 0);

    // MECÁNICA CLAVE: Pasar por encima de la cola (Overpass / Salto de cola)
    if (g.buff === 'escudo') {
      jumped = true;
      g.vaultCount++;
    } else if (g.freeVaults > 0) {
      g.freeVaults--;
      jumped = true;
      g.vaultCount++;
      addFloater(T('f.saltoGratis'), (nextX + 0.5) * g.tile, (nextY + 0.5) * g.tile - 16, '#00E5FF');
      spawnParticleBurst((nextX + 0.5) * g.tile, (nextY + 0.5) * g.tile, '#00E5FF', 14);
    } else {
      let vaultCost = 10;
      if (phantomStacks > 0) {
        vaultCost = Math.max(2, 4 - (phantomStacks - 1) * 1);
      }
      // El apalancamiento encarece el salto igual que multiplica el bote;
      // Salto Caro lo dobla encima.
      vaultCost = Math.ceil(vaultCost * g.apalancamiento * g.mecanica.saltoCoste);

      if (g.energy >= vaultCost) {
        g.energy -= vaultCost;
        jumped = true;
        g.vaultCount++;

        if (elasticStacks > 0) {
          const regen = 15 * elasticStacks;
          g.energy = Math.min(g.maxEnergy, g.energy + regen);
          addFloater(T('f.rebote', { n: regen }), (nextX + 0.5) * g.tile, (nextY + 0.5) * g.tile - 16, '#00E676');
        } else {
          addFloater(T('f.salto', { n: vaultCost }), (nextX + 0.5) * g.tile, (nextY + 0.5) * g.tile - 16, '#FFD54F');
        }

        spawnParticleBurst((nextX + 0.5) * g.tile, (nextY + 0.5) * g.tile, '#00E5FF', 16);
        g.cameraShake = 5;
      } else if (usarSegundaVida()) {
        jumped = true;
        g.vaultCount++;
      } else {
        // Energía insuficiente para saltar el leviatán: colisión y fin de run
        spawnParticleBurst((nextX + 0.5) * g.tile, (nextY + 0.5) * g.tile, '#FF1744', 32);
        morir(T('muerte.salto'));
        return;
      }
    }
  }

  // Insertar nueva posición de la cabeza
  g.snake.unshift({
    x: nextX,
    y: nextY,
    jump: jumped ? 1.0 : 0
  });
  fx.registrarRastro(g, nextX, nextY);
  recogerArtefacto(nextX, nextY);
  if (jumped) {
    sfx.tocar('salto');
    fx.onda(g, (nextX + 0.5) * g.tile, (nextY + 0.5) * g.tile, { maxR: 46, dur: 0.3, color: fx.CIAN, grosor: 2 });
  }

  // Comprobar comida de frutas (tolerancia amplia para coordenadas continuas/atraídas por imán)
  let ateFruitIndex = -1;
  for (let i = 0; i < g.fruits.length; i++) {
    const f = g.fruits[i];
    const distNext = Math.hypot(f.x - nextX, f.y - nextY);
    const distHead = Math.hypot(f.x - head.x, f.y - head.y);
    if (distNext <= 1.25 || distHead <= 1.15 || (Math.round(f.x) === nextX && Math.round(f.y) === nextY)) {
      ateFruitIndex = i;
      break;
    }
  }

  if (ateFruitIndex !== -1) {
    const fruit = g.fruits.splice(ateFruitIndex, 1)[0];
    onEatFruit(fruit);
  } else {
    // Si no comió fruta, retirar la punta de la cola para mantener longitud
    g.snake.pop();
  }

  // Reducir la animación de elevación de salto en segmentos
  for (const s of g.snake) {
    if (s.jump > 0) s.jump = Math.max(0, s.jump - 0.25);
  }

  if (g.snake.length > g.maxTailAchieved) {
    g.maxTailAchieved = g.snake.length;
  }
}

function onEatFruit(fruit, porIman = false) {
  const g = inst.game;
  g.fruitsEaten++;

  const batteryStacks = (g.perkStacks && g.perkStacks.get('battery_upgrade')) || (g.activePerks.has('battery_upgrade') ? 1 : 0);
  const denseStacks = (g.perkStacks && g.perkStacks.get('dense_nutrition')) || (g.activePerks.has('dense_nutrition') ? 1 : 0);
  const twinStacks = (g.perkStacks && g.perkStacks.get('twin_fruits')) || (g.activePerks.has('twin_fruits') ? 1 : 0);

  // Crecimiento de cola: base 1, ampliado por nutrición densa (+1 segmento por nivel)
  const growth = 1 + denseStacks;
  for (let i = 0; i < growth; i++) {
    const tailTip = g.snake[g.snake.length - 1];
    g.snake.push({ x: tailTip.x, y: tailTip.y, jump: 0 });
  }

  // Puntos de experiencia y energía base según el tipo de fruta (nerfeada):
  let baseFruitXp = 5;
  let baseFruitEnergy = 36;

  if (fruit.type === 'mutant') {
    baseFruitXp = 14;
    baseFruitEnergy = 75;
  } else if (fruit.type === 'phase') {
    baseFruitXp = 9;
    baseFruitEnergy = 36;
  } else if (fruit.type === 'hyper') {
    baseFruitXp = 8;
    baseFruitEnergy = 60;
  } else {
    baseFruitXp = 5;
    baseFruitEnergy = 36;
  }

  // Restauración de energía (acumulable con Batería Nuclear y Nutrición Densa)
  let energyGain = baseFruitEnergy;
  if (batteryStacks > 0) energyGain += 18 * batteryStacks;
  if (denseStacks > 0) energyGain += 12 * denseStacks;
  g.energy = Math.min(g.maxEnergy, g.energy + energyGain);

  // Ganancia de XP: Si tiene Nutrición Densa, añade poder de experiencia pero SOLO x2 exacto
  let xpGain = baseFruitXp;
  if (denseStacks > 0) xpGain *= 2;
  // Ritmo de niveles (ver XP_DILUCION_*): los perks que aceleran el consumo
  // diluyen la XP por fruta, y en el enfriamiento tras subir entra a un tercio.
  xpGain /= 1 + XP_DILUCION_FRUTAS * twinStacks + XP_DILUCION_IMAN * stacksDe(g, 'quantum_magnet');
  if (g.nivelTimer < NIVEL_ENFRIAMIENTO) xpGain *= XP_EN_ENFRIAMIENTO;
  xpGain = Math.max(1, Math.round(xpGain));
  g.xp += xpGain;

  // ---- bucle de apuesta ----
  // Racha: la fruta llego dentro de la ventana -> sube; la ventana se estrecha.
  g.racha++;
  if (g.racha > g.rachaMax) g.rachaMax = g.racha;
  g.rachaVentana = Math.max(RACHA_VENTANA_MIN, RACHA_VENTANA_MAX - g.racha * 0.12);
  g.rachaTimer = g.rachaVentana;
  const multRacha = multiplicadorRacha(g.racha);

  sfx.tocar('comer', { racha: g.racha });
  fx.onda(g, (fruit.x + 0.5) * g.tile, (fruit.y + 0.5) * g.tile, { maxR: 34 + Math.min(60, g.racha * 5), dur: 0.32, color: fx.hsl(fx.tonoRacha(multRacha, g.frenesiActiva), 100, 65), grosor: 2 });

  // Puntos directos (seguros) y bote (en juego). Racha, apalancamiento y
  // frenesi solo pagan a traves del bote: hay que cobrarlo o que lo pague el jackpot.
  const valor = Math.round((VALOR_FRUTA[fruit.type] || VALOR_FRUTA.normal) * g.mecanica.mult);
  g.puntos += valor;
  const alBote = Math.round(valor * multRacha * g.apalancamiento * (g.frenesiActiva ? 2 : 1) * (g.buff === 'bote' ? 2 : 1));
  g.bote += alBote;
  g.botePop = 1;

  // Medidor de frenesi: cada fruta lo llena mas cuanto mas larga la racha.
  // Durante el bajon no se llena: la resaca es el precio del frenesí.
  if (!g.frenesiActiva && g.bajonTimer <= 0) {
    g.frenesi = Math.min(1, g.frenesi + FRENESI_POR_FRUTA + FRENESI_POR_RACHA * g.racha);
  }

  // Efectos según tipo de fruta
  const fx_ = (fruit.x + 0.5) * g.tile;
  const fy_ = (fruit.y + 0.5) * g.tile;

  if (fruit.type === 'phase') {
    g.freeVaults += 2;
    addFloater(T('f.cristal', { x: xpGain }), fx_, fy_ - 18, '#00E5FF');
    spawnParticleBurst(fx_, fy_, '#00E5FF', 24);
  } else if (fruit.type === 'hyper') {
    addFloater(T('f.hiper', { e: energyGain, x: xpGain }), fx_, fy_ - 18, '#FF5252');
    spawnParticleBurst(fx_, fy_, '#FF5252', 26);
  } else if (fruit.type === 'mutant') {
    g.jackpotFichas++;
    sfx.tocar('ficha');
    addFloater(T('f.ficha', { a: g.jackpotFichas, b: JACKPOT_FRUTAS, e: energyGain, x: xpGain }), fx_, fy_ - 18, '#FFD54F', { tam: 13, glow: 12 });
    spawnParticleBurst(fx_, fy_, '#FFD54F', 32);
    if (g.jackpotFichas >= JACKPOT_FRUTAS) {
      g.jackpotFichas = 0;
      iniciarTragaperras();
    }
  } else {
    addFloater(T('f.normal', { e: energyGain, g: growth, x: xpGain }), fx_, fy_ - 18, '#00E676');
    spawnParticleBurst(fx_, fy_, '#00E676', 20);
  }

  g.cameraShake = Math.max(g.cameraShake, 4);

  if (g.racha > 1) {
    const tono = fx.hsl(fx.tonoRacha(multRacha, g.frenesiActiva), 100, 72);
    addFloater(`x${multRacha.toFixed(2)}`, fx_, fy_ - 44, tono, { tam: 15 + Math.min(14, g.racha * 1.2), glow: 14, dur: 0.9 });
    addFloater(T('f.alBote', { n: alBote }), fx_, fy_ - 26, '#FFD54F', { tam: 11 });
    if (g.racha % 5 === 0) {
      // Hito de racha: onda, golpe de acorde y un texto que crece con la racha
      fx.onda(g, fx_, fy_, { maxR: 160 + g.racha * 6, dur: 0.55, color: tono, grosor: 4 });
      g.cameraShake = Math.max(g.cameraShake, 5 + Math.min(6, g.racha * 0.3));
      sfx.tocar('hito', { n: g.racha });
      addFloater(T('f.hito', { n: g.racha }), g.w / 2, g.h / 3, tono, { tam: 22 + Math.min(14, g.racha * 0.8), glow: 18, dur: 1.0 });
    }
  }
  if (!g.frenesiActiva && g.frenesi >= 1) {
    iniciarFrenesi();
  }

  // Comprobar subida de nivel por XP (la barra escala exponencialmente)
  comprobarNivel();

  // Respawn de nueva fruta lejana respetando Frutas Múltiples (hasta 3 frutas simultáneas base)
  const targetCount = twinStacks > 0 ? (1 + 2 * twinStacks) : 1;
  rellenarFrutas(targetCount);
}

// ---- artefactos -------------------------------------------------------------

function colorArtefacto(tipo) {
  return tipo === 'portal' ? fx.VIOLETA : tipo === 'impulso' ? fx.CIAN : tipo === 'barrido' ? fx.ORO : fx.MAGENTA;
}

function celdaLibreLejana(g, minDist) {
  const head = g.snake[0];
  const ocupadas = new Set();
  for (const s of g.snake) ocupadas.add(`${s.x},${s.y}`);
  for (const f of g.fruits) ocupadas.add(`${Math.round(f.x)},${Math.round(f.y)}`);
  for (const a of g.artefactos) ocupadas.add(`${a.x},${a.y}`);
  const candidatas = [];
  for (let x = 1; x < g.gridCols - 1; x++) {
    for (let y = 1; y < g.gridRows - 1; y++) {
      if (ocupadas.has(`${x},${y}`)) continue;
      if (Math.hypot(x - head.x, y - head.y) < minDist) continue;
      candidatas.push({ x, y });
    }
  }
  return candidatas.length ? candidatas[Math.floor(Math.random() * candidatas.length)] : null;
}

function spawnArtefacto() {
  const g = inst.game;
  if (!g || g.artefactos.length >= 3) return;
  const tipo = ARTEFACTO_TIPOS[Math.floor(Math.random() * ARTEFACTO_TIPOS.length)];
  const a = celdaLibreLejana(g, ARTEFACTO_DIST_MIN);
  if (!a) return;
  const art = { tipo, x: a.x, y: a.y, vida: ARTEFACTO_VIDA, par: null };
  g.artefactos.push(art);
  if (tipo === 'portal') {
    const b = celdaLibreLejana(g, ARTEFACTO_DIST_MIN);
    if (!b) { g.artefactos.pop(); return; }
    const salida = { tipo, x: b.x, y: b.y, vida: ARTEFACTO_VIDA, par: art };
    art.par = salida;
    g.artefactos.push(salida);
  }
  sfx.tocar('artefacto');
  fx.onda(g, (a.x + 0.5) * g.tile, (a.y + 0.5) * g.tile, { maxR: 60, dur: 0.5, color: colorArtefacto(tipo), grosor: 2 });
}

function recogerArtefacto(x, y) {
  const g = inst.game;
  const i = g.artefactos.findIndex((a) => a.x === x && a.y === y);
  if (i === -1) return;
  const a = g.artefactos[i];
  const px = (x + 0.5) * g.tile;
  const py = (y + 0.5) * g.tile;
  g.artefactosRecogidos++;

  if (a.tipo === 'portal') {
    // Entrar por un extremo saca por el otro; el par sigue vivo para volver
    const otro = a.par;
    if (otro) {
      g.snake[0].x = otro.x;
      g.snake[0].y = otro.y;
      fx.registrarRastro(g, otro.x, otro.y);
      fx.onda(g, px, py, { maxR: 90, dur: 0.4, color: fx.VIOLETA, grosor: 3 });
      fx.onda(g, (otro.x + 0.5) * g.tile, (otro.y + 0.5) * g.tile, { maxR: 120, dur: 0.5, color: fx.VIOLETA, grosor: 3 });
      fx.flash(g, fx.VIOLETA, 0.2, 0.3);
      sfx.tocar('portal');
      addFloater(T('f.portal'), (otro.x + 0.5) * g.tile, (otro.y + 0.5) * g.tile - 26, fx.VIOLETA, { tam: 14, glow: 12 });
    }
    return;
  }

  g.artefactos.splice(i, 1);
  spawnParticleBurst(px, py, colorArtefacto(a.tipo), 28);
  fx.onda(g, px, py, { maxR: 160, dur: 0.5, color: colorArtefacto(a.tipo), grosor: 4 });
  sfx.tocar('artefactoRecogido');

  if (a.tipo === 'impulso') {
    g.impulso = IMPULSO_DURACION;
    addFloater(T('f.impulso', { s: IMPULSO_DURACION }), px, py - 26, fx.CIAN, { tam: 15, glow: 12 });
  } else if (a.tipo === 'barrido') {
    g.barrido = BARRIDO_DURACION;
    // Duplicar: por cada fruta, otra cerca (sin pasar de la arena)
    const extra = Math.min(BARRIDO_EXTRA_MAX, g.fruits.length);
    for (let k = 0; k < extra; k++) {
      const f = g.fruits[k];
      const c = celdaLibreLejana(g, 0);
      if (c) g.fruits.push({ x: c.x, y: c.y, type: f.type === 'mutant' ? 'normal' : f.type, pulse: 0, birthTime: g.runTime });
    }
    addFloater(T('f.barrido', { n: extra }), px, py - 26, fx.ORO, { tam: 15, glow: 12 });
  } else if (a.tipo === 'euforia') {
    addFloater(T('f.artefactoEuforia'), px, py - 26, fx.MAGENTA, { tam: 15, glow: 12 });
    if (!g.frenesiActiva) { g.frenesi = 1; iniciarFrenesi(); }
    else g.frenesiTimer += FRENESI_DURACION * 0.5;
  }
}

// ---- bucle de apuesta: racha, bote, apalancamiento, jackpot, frenesi --------

function stacksDe(g, perkId) {
  return (g.perkStacks && g.perkStacks.get(perkId)) || (g.activePerks.has(perkId) ? 1 : 0);
}

function multiplicadorRacha(racha) {
  return Math.min(RACHA_MULT_TOPE, 1 + RACHA_MULT_POR_FRUTA * racha);
}

// Gasto metabolico por segundo SIN el turbo (que se suma aparte). Es la unica
// fuente de verdad: la usan gameTick y el HUD, que antes la duplicaban.
function calcularGasto(g) {
  const tailLen = g.snake.length;
  let lengthDrain = Math.max(0, tailLen - 4) * 0.26;

  const cryoStacks = stacksDe(g, 'cryo_metabolism');
  if (cryoStacks > 0) lengthDrain *= getCryoMultiplier(cryoStacks);

  const cosmicStacks = stacksDe(g, 'cosmic_resonance');
  if (cosmicStacks > 0) {
    const tiers = Math.min(RESONANCIA_TRAMOS_MAX, Math.floor(tailLen / 10));
    if (tiers > 0) lengthDrain *= Math.pow(1 - 0.15 * 1.15, tiers * cosmicStacks); // -17.25% por tramo
  }

  let total = 2.2 + lengthDrain;

  const compassStacks = stacksDe(g, 'hyperspace_compass');
  if (compassStacks > 0) total *= Math.pow(1 - 0.35 * 1.15, compassStacks); // -40.25% por nivel

  // El piso proporcional manda: las cartas no bajan de aqui
  total = Math.max(total, GASTO_PISO_BASE + GASTO_PISO_POR_SEGMENTO * tailLen);

  // Apalancamiento: el gasto base sube con la posicion abierta
  total *= 1 + GASTO_POR_APALANCAMIENTO * (g.apalancamiento - 1);

  // Bajon tras el frenesí
  if (g.bajonTimer > 0) total *= BAJON_GASTO;

  // Mecanica superior: Metabolismo Doble
  if (g.mecanica.gasto) total *= g.mecanica.gasto;

  return total;
}

// La muerte no es instantanea: el holograma se rompe medio segundo (glitch,
// flash rojo, sacudida) y despues sale el resumen. El impacto se siente.
function morir(razon) {
  const g = inst.game;
  if (!g || g.state !== 'playing') return;
  g.state = 'muriendo';
  g.muerteRazon = razon;
  g.muerteTimer = 0.7;
  g.hitStop = 0;
  fx.flash(g, fx.ROJO, 0.85, 0.7);
  sfx.tocar(/LIQUID/.test(razon) ? 'liquidado' : 'muerte');
  const head = g.snake[0];
  fx.onda(g, (head.x + 0.5) * g.tile, (head.y + 0.5) * g.tile, { maxR: 420, dur: 0.7, color: fx.ROJO, grosor: 6 });
}

// Segunda Vida: perdona una muerte por run. Devuelve true si la absorbio.
function usarSegundaVida() {
  const g = inst.game;
  if (!g || g.vidasExtra <= 0) return false;
  g.vidasExtra--;
  sfx.tocar('segundaVida');
  fx.flash(g, fx.VERDE, 0.5, 0.5);
  g.hitStop = 0.22;
  const head = g.snake[0];
  fx.onda(g, (head.x + 0.5) * g.tile, (head.y + 0.5) * g.tile, { maxR: 240, dur: 0.6, color: fx.VERDE, grosor: 5 });
  addFloater(T('f.segundaVida'), (head.x + 0.5) * g.tile, (head.y + 0.5) * g.tile - 20, '#00E676');
  spawnParticleBurst((head.x + 0.5) * g.tile, (head.y + 0.5) * g.tile, '#00E676', 30);
  g.cameraShake = 8;
  return true;
}

function nivelesDisponibles(g) {
  return g.apalancamientoMax >= APALANCAMIENTO_DEGEN
    ? NIVELES_APALANCAMIENTO.concat([APALANCAMIENTO_DEGEN])
    : NIVELES_APALANCAMIENTO;
}

function setApalancamiento(nuevo) {
  const g = inst.game;
  if (!g || g.state !== 'playing') return;
  if (nivelesDisponibles(g).indexOf(nuevo) === -1 || nuevo === g.apalancamiento) return;
  if (g.mecanica.apalancamientoMin && nuevo < g.mecanica.apalancamientoMin) {
    addFloater(T('f.todoApalancado', { n: g.mecanica.apalancamientoMin }), g.w / 2, g.h / 3, '#FF7043');
    return;
  }

  const cx = g.w / 2;
  const cy = g.h / 3;

  // Subir es gratis y tentador. Bajar es cerrar posicion: quema parte del bote.
  if (nuevo < g.apalancamiento && g.bote > 0) {
    const quema = Math.round(g.bote * PENALIZACION_BAJAR);
    g.bote -= quema;
    addFloater(T('f.cerrarPosicion', { n: quema }), cx, cy + 22, '#FF7043');
  }

  const subio = nuevo > g.apalancamiento;
  g.apalancamiento = nuevo;
  sfx.tocar(subio ? 'apalancarSubir' : 'apalancarBajar', { nivel: nuevo });
  fx.onda(g, (g.snake[0].x + 0.5) * g.tile, (g.snake[0].y + 0.5) * g.tile, { maxR: 120, dur: 0.4, color: nuevo >= LIQUIDACION_DESDE ? fx.ROJO : fx.CIAN, grosor: 3 });
  if (nuevo >= LIQUIDACION_DESDE) fx.flash(g, fx.ROJO, 0.22, 0.3);
  const aviso = nuevo >= LIQUIDACION_DESDE ? T('f.liquidadoAviso') : '';
  addFloater(T('f.apalancamiento', { n: nuevo, aviso }), cx, cy, nuevo >= LIQUIDACION_DESDE ? '#FF1744' : '#00E5FF');
  g.cameraShake = Math.max(g.cameraShake, 3);
}

function cobrarBote() {
  const g = inst.game;
  if (!g || g.state !== 'playing' || g.bote <= 0) return;
  if (g.mecanica.sinCobro) {
    addFloater(T('f.volatil'), g.w / 2, g.h / 3, '#FF7043');
    return;
  }
  const cobrado = g.bote;
  g.puntos += cobrado;
  g.bote = 0;
  g.cobros++;
  const head = g.snake[0];
  const hx = (head.x + 0.5) * g.tile;
  const hy = (head.y + 0.5) * g.tile;
  addFloater(`+${cobrado}`, hx, hy - 30, '#00E676', { tam: 22, glow: 16, dur: 1.2 });
  addFloater(T('f.cobrado'), hx, hy - 52, '#00E676', { tam: 11 });
  sfx.tocar('cobrar', { monedas: Math.round(cobrado / 120) });
  fx.flash(g, fx.VERDE, 0.22, 0.3);
  fx.onda(g, hx, hy, { maxR: 140, dur: 0.45, color: fx.VERDE, grosor: 3 });
  fx.lanzarMonedas(g, hx, hy, g.w - 70, -20, Math.max(5, Math.min(22, Math.round(cobrado / 150))));
}

function comprobarNivel() {
  const g = inst.game;
  if (g.xp >= g.xpNext && g.state === 'playing') {
    g.xp = Math.max(0, g.xp - g.xpNext);
    g.level++;
    g.xpNext = calculateXpNext(g.level);
    g.nivelTimer = 0;
    triggerLevelUp();
  }
}

function simboloDe(id) {
  return TRAGAPERRAS_SIMBOLOS.find((x) => x.id === id) || TRAGAPERRAS_SIMBOLOS[0];
}

function nombreSimbolo(s) { return T('sym.' + s.id + '.name', null, s.name); }
function descSimbolo(s) { return T('sym.' + s.id + '.desc', null, s.desc); }

// Alcance efectivo: con Iman Total (tragaperras) toda la arena; si no, la carta.
function alcanceIman(g) {
  if (g.buff === 'iman') return Math.hypot(g.gridCols, g.gridRows);
  return getMagnetRange(stacksDe(g, 'quantum_magnet'));
}

function iniciarTragaperras() {
  const g = inst.game;
  if (!g || g.state !== 'playing') return;
  g.state = 'tragaperras';
  g.tiradas++;

  // Primero se sortea el resultado; los rodillos se pintan para que cuadre.
  let tipo;
  {
    const total = TRAGAPERRAS_PESOS.triple + TRAGAPERRAS_PESOS.pareja + TRAGAPERRAS_PESOS.nada;
    let r = Math.random() * total;
    if ((r -= TRAGAPERRAS_PESOS.triple) <= 0) tipo = 'triple';
    else if ((r -= TRAGAPERRAS_PESOS.pareja) <= 0) tipo = 'pareja';
    else tipo = 'nada';
  }
  // Martingala: tras una tirada sin pareja, la siguiente garantiza pareja
  if (tipo === 'nada' && g.ultimaTiradaNada && stacksDe(g, 'martingala') > 0) tipo = 'pareja';

  const azar = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const premio = azar(TRAGAPERRAS_SIMBOLOS);
  let simbolos;
  if (tipo === 'triple') {
    simbolos = [premio, premio, premio];
  } else if (tipo === 'pareja') {
    const otro = azar(TRAGAPERRAS_SIMBOLOS.filter((x) => x.id !== premio.id));
    simbolos = [premio, premio, otro];
    // la pareja puede caer en cualquier par de rodillos (el tercero rompe la ilusion)
    const pos = Math.floor(Math.random() * 3);
    simbolos = [0, 1, 2].map((i) => (i === pos ? otro : premio));
  } else {
    const barajado = [...TRAGAPERRAS_SIMBOLOS].sort(() => 0.5 - Math.random());
    simbolos = barajado.slice(0, 3);
  }

  g.tragaperras = { t: 0, simbolos, tipo, premio, mostrado: false, cerrado: false, ultimoK: [-1, -1, -1], escala: [1, 1, 1] };
  for (const r of inst.els.rodillos) { r.dataset.parado = '0'; r.style.transform = ''; }
  inst.els.tragaperrasResultado.textContent = '';
  inst.els.tragaperrasResultado.style.transform = 'scale(0.6)';
  inst.els.tragaperrasResultado.style.opacity = '0';
  inst.els.modalTragaperras.style.background = '';
  inst.els.modalTragaperras.dataset.visible = '1';
  g.cameraShake = 4;
  sfx.tocar('carta');
}

function actualizarTragaperras(dt) {
  const g = inst.game;
  const tp = g.tragaperras;
  if (!tp) return;
  tp.t += dt;

  // Rodillos: giran (cambian de simbolo) hasta su parada; luego muestran el suyo
  for (let i = 0; i < 3; i++) {
    const el = inst.els.rodillos[i];
    if (!el) continue;
    if (tp.t < TRAGAPERRAS_PARADAS[i]) {
      const k = Math.floor(tp.t * 14 + i * 2) % TRAGAPERRAS_SIMBOLOS.length;
      if (k !== tp.ultimoK[i]) {
        tp.ultimoK[i] = k;
        el.innerHTML = ico(TRAGAPERRAS_SIMBOLOS[k].icon, 'sr-ico--rodillo');
        sfx.tocar('giro');
      }
      // vibra mientras gira
      el.style.transform = `translateY(${(Math.random() - 0.5) * 6}px)`;
    } else if (el.dataset.parado !== '1') {
      el.innerHTML = ico(tp.simbolos[i].icon, 'sr-ico--rodillo');
      el.dataset.parado = '1';
      tp.escala[i] = 1.35;
      sfx.tocar('rodilloPara');
      g.cameraShake = Math.max(g.cameraShake, 5);
    }
    if (el.dataset.parado === '1') {
      tp.escala[i] = Math.max(1, tp.escala[i] - dt * 2.2);
      el.style.transform = `scale(${tp.escala[i].toFixed(3)})`;
    }
  }

  const finGiro = TRAGAPERRAS_PARADAS[2];
  if (tp.t >= finGiro && !tp.mostrado) {
    tp.mostrado = true;
    const p = tp.premio;
    let texto;
    if (tp.tipo === 'triple') texto = T('slot.triple', { nombre: nombreSimbolo(p), s: BUFF_DURACION, pago: g.bote * 3 });
    else if (tp.tipo === 'pareja') texto = T('slot.pareja', { nombre: nombreSimbolo(p), s: BUFF_DURACION, desc: descSimbolo(p) });
    else texto = T('slot.nada', { n: TRAGAPERRAS_CONSUELO });
    inst.els.tragaperrasResultado.innerHTML = (tp.tipo === 'triple' ? ico('corona') + ' ' : tp.tipo === 'pareja' ? ico(p.icon) + ' ' : '') + texto;
    inst.els.tragaperrasResultado.dataset.tipo = tp.tipo;
    inst.els.tragaperrasResultado.style.transform = 'scale(1)';
    inst.els.tragaperrasResultado.style.opacity = '1';
    if (tp.tipo === 'triple') {
      sfx.tocar('triple');
      fx.flash(g, fx.ORO, 0.9, 0.9);
      fx.onda(g, g.w / 2, g.h / 2, { maxR: 640, dur: 0.9, color: fx.ORO, grosor: 8 });
      fx.onda(g, g.w / 2, g.h / 2, { maxR: 420, dur: 0.7, color: fx.VIOLETA, grosor: 5 });
      for (const col of [fx.ORO, fx.VIOLETA, fx.CIAN, '#FFFFFF']) spawnParticleBurst(g.w / 2, g.h / 2, col, 40);
      g.hitStop = 0.45;
      g.cameraShake = 14;
    } else if (tp.tipo === 'pareja') {
      sfx.tocar('pareja');
      fx.flash(g, fx.VERDE, 0.35, 0.45);
      fx.onda(g, g.w / 2, g.h / 2, { maxR: 260, dur: 0.6, color: fx.VERDE, grosor: 4 });
      g.cameraShake = 6;
    } else {
      sfx.tocar('nada');
      fx.flash(g, '#94A3B8', 0.12, 0.3);
      g.cameraShake = 2;
    }
  }
  // El fondo del modal late en oro si salio triple
  if (tp.mostrado && tp.tipo === 'triple') {
    const k = 0.35 + 0.25 * Math.sin(g.tiempo * 14);
    inst.els.modalTragaperras.style.background = `rgba(60, 40, 0, ${k.toFixed(3)})`;
  }
  if (tp.t >= finGiro + TRAGAPERRAS_MOSTRAR && !tp.cerrado) {
    tp.cerrado = true;
    terminarTragaperras();
  }
}

function terminarTragaperras() {
  const g = inst.game;
  const tp = g.tragaperras;
  inst.els.modalTragaperras.dataset.visible = '0';
  g.tragaperras = null;
  g.state = 'playing';
  g.ultimaTiradaNada = tp.tipo === 'nada';

  const cx = g.w / 2;
  const cy = g.h / 3;
  if (tp.tipo === 'triple') {
    g.triples++;
    const pago = g.bote * 3;
    g.puntos += pago;
    if (pago > g.mayorJackpot) g.mayorJackpot = pago;
    g.bote = 0;
    aplicarBuff(tp.premio);
    addFloater(`+${pago}`, cx, cy + 10, fx.ORO, { tam: 30, glow: 22, dur: 1.4 });
    addFloater(T('slot.tripleFloat'), cx, cy + 40, '#E040FB', { tam: 13 });
    spawnParticleBurst(cx, cy, '#E040FB', 48);
    fx.lanzarMonedas(g, cx, cy, g.w - 70, -20, 26);
  } else if (tp.tipo === 'pareja') {
    aplicarBuff(tp.premio);
  } else {
    g.energy = Math.min(g.maxEnergy, g.energy + TRAGAPERRAS_CONSUELO);
    addFloater(T('slot.consuelo', { n: TRAGAPERRAS_CONSUELO }), cx, cy, '#94A3B8');
  }

  // Una subida de nivel que hubiera quedado pendiente durante la tirada
  comprobarNivel();
}

function aplicarBuff(simbolo) {
  const g = inst.game;
  g.buff = simbolo.id;
  g.buffTimer = BUFF_DURACION;
  sfx.tocar('buffInicio');
  addFloater(T('f.buff', { n: nombreSimbolo(simbolo), s: BUFF_DURACION }), g.w / 2, g.h / 3, '#FFD54F', { tam: 16, glow: 14 });
  spawnParticleBurst(g.w / 2, g.h / 3, '#FFD54F', 30);
}

function iniciarFrenesi() {
  const g = inst.game;
  if (!g || g.frenesiActiva) return;
  g.frenesiActiva = true;
  g.frenesiTimer = FRENESI_DURACION + 2 * Math.max(0, stacksDe(g, 'sin_resaca') - 1);
  g.frenesi = 1;
  g.frenesis++;
  addFloater(T('f.frenesi'), g.w / 2, g.h / 3 - 10, '#FF4081', { tam: 30, glow: 24, dur: 1.4 });
  addFloater(T('f.frenesiSub'), g.w / 2, g.h / 3 + 18, '#FF4081', { tam: 12 });
  spawnParticleBurst(g.w / 2, g.h / 3, '#FF4081', 40);
  g.cameraShake = 8;
  sfx.tocar('frenesiInicio');
  fx.flash(g, fx.MAGENTA, 0.55, 0.6);
  fx.onda(g, (g.snake[0].x + 0.5) * g.tile, (g.snake[0].y + 0.5) * g.tile, { maxR: 520, dur: 0.8, color: fx.MAGENTA, grosor: 6 });
  g.hitStop = 0.14;
  // Lluvia: tres frutas mas, y cerca (spawnFruit lo sabe por frenesiActiva)
  rellenarFrutas(g.fruits.length + 3);
}

function terminarFrenesi() {
  const g = inst.game;
  g.frenesiActiva = false;
  sfx.tocar('frenesiFin');
  fx.flash(g, '#3B5B8A', 0.3, 0.5);
  g.frenesiTimer = 0;
  g.frenesi = 0;
  g.racha = 0;
  g.rachaTimer = 0;
  if (stacksDe(g, 'sin_resaca') > 0) {
    addFloater(T('f.frenesiFinResaca'), g.w / 2, g.h / 3, '#00E5FF');
  } else {
    g.bajonTimer = BAJON_DURACION;
    addFloater(T('f.bajon', { g: BAJON_GASTO, s: BAJON_DURACION }), g.w / 2, g.h / 3, '#FF7043');
  }
}

function actualizarApuesta(dt) {
  const g = inst.game;
  if (g.frenesiActiva) {
    g.frenesiTimer -= dt;
    g.frenesi = Math.max(0, g.frenesiTimer / FRENESI_DURACION);
    if (g.frenesiTimer <= 0) terminarFrenesi();
    return; // la racha no caduca en frenesí
  }
  if (g.bajonTimer > 0) {
    g.bajonTimer = Math.max(0, g.bajonTimer - dt);
  }
  if (g.racha > 0) {
    g.rachaTimer -= dt;
    if (g.rachaTimer <= 0) {
      const perdida = g.racha;
      g.racha = 0;
      g.rachaTimer = 0;
      if (perdida > 1) {
        addFloater(T('f.rachaPerdida', { m: multiplicadorRacha(perdida).toFixed(2) }), g.w / 2, g.h / 3, '#94A3B8');
        sfx.tocar('rachaRota');
      }
    }
  } else if (g.frenesi > 0) {
    g.frenesi = Math.max(0, g.frenesi - FRENESI_ENFRIADO * dt); // sin racha, el medidor se enfria
  }
}

// ---- sistema roguelite de mutaciones --------------------------------------

function triggerLevelUp() {
  const g = inst.game;
  if (!g || g.state !== 'playing') return;

  g.state = 'level_up';

  // Baraja 3 cartas del catálogo para ofrecer al jugador
  const excluidas = g.mecanica.excluye || [];
  const disponibles = PERK_CATALOG.filter((c) => excluidas.indexOf(c.id) === -1);
  const shuffled = [...disponibles].sort(() => 0.5 - Math.random());
  const selectedCards = shuffled.slice(0, 3);

  inst.els.cardsGrid.innerHTML = selectedCards.map(c => {
    const stacks = (g.perkStacks && g.perkStacks.get(c.id)) || (g.activePerks.has(c.id) ? 1 : 0);
    let badgeText = T('perk.' + c.id + '.badge', null, c.badge);
    if (stacks > 0) {
      badgeText = T('nivel.mejora', { n: stacks + 1 });
    }
    return [
      `<div class="sr-card" data-perk="${c.id}">`,
      `  <div class="sr-card__icon">${ico(c.icon, 'sr-ico--carta')}</div>`,
      `  <div class="sr-card__name">${T('perk.' + c.id + '.name', null, c.name)}</div>`,
      `  <div class="sr-card__desc">${T('perk.' + c.id + '.desc', null, c.desc)}</div>`,
      `  <div class="sr-card__badge">${badgeText}</div>`,
      `</div>`
    ].join('\n');
  }).join('\n');

  inst.els.modalLevelup.dataset.visible = '1';
  sfx.tocar('nivel');
  fx.flash(g, fx.CIAN, 0.3, 0.5);
  fx.onda(g, (g.snake[0].x + 0.5) * g.tile, (g.snake[0].y + 0.5) * g.tile, { maxR: 300, dur: 0.7, color: fx.CIAN, grosor: 4 });
}

function selectPerk(perkId) {
  const g = inst.game;
  if (!g || g.state !== 'level_up') return;

  g.activePerks.add(perkId);
  const stacks = ((g.perkStacks && g.perkStacks.get(perkId)) || 0) + 1;
  if (g.perkStacks) g.perkStacks.set(perkId, stacks);

  // Aplicar bonificaciones acumulables al subir de nivel
  if (perkId === 'degen') {
    g.apalancamientoMax = APALANCAMIENTO_DEGEN;
    addFloater(T('f.degen', { n: APALANCAMIENTO_DEGEN }), g.w / 2, g.h / 3 - 25, '#FF1744');
  } else if (perkId === 'sin_resaca') {
    g.bajonTimer = 0;
    addFloater(T('f.sinResaca'), g.w / 2, g.h / 3 - 25, '#00E5FF');
  } else if (perkId === 'battery_upgrade') {
    g.maxEnergy += 50;
    g.energy = g.maxEnergy;
    addFloater(T('f.bateria', { n: stacks, m: g.maxEnergy }), g.w / 2, g.h / 3 - 25, '#00E5FF');
  } else if (perkId === 'twin_fruits') {
    const targetCount = 1 + 2 * stacks;
    rellenarFrutas(targetCount);
    addFloater(T('f.frutas', { n: stacks, t: targetCount }), g.w / 2, g.h / 3 - 25, '#FF5252');
  } else if (perkId === 'phantom_vault') {
    g.freeVaults += 3;
    addFloater(T('f.fantasma', { n: g.freeVaults }), g.w / 2, g.h / 3 - 25, '#00E5FF');
  }

  inst.els.modalLevelup.dataset.visible = '0';
  g.state = 'playing';
  sfx.tocar('carta');
  addFloater(T('f.mutacion'), g.w / 2, g.h / 3, '#00E5FF', { tam: 15, glow: 12 });
  spawnParticleBurst(g.w / 2, g.h / 3, '#00E5FF', 36);
}

// ---- mecanicas superiores: seleccion previa a la run ----------------------

function mostrarMenu() {
  const g = inst.game;
  if (!g) return;
  g.state = 'menu';
  inst.els.modalSummary.dataset.visible = '0';
  inst.els.modalLevelup.dataset.visible = '0';
  inst.els.modalMecanica.dataset.visible = '0';
  mostrarPanel('principal');
  cargarRanking();
  inst.els.menuRecord.textContent = T('menu.record', { pts: records.puntos, cola: records.cola });
  inst.els.modalMenu.dataset.visible = '1';
  updateHUD();
}

// Paneles del menú: 'principal', 'controles' o 'acerca'.
function mostrarPanel(nombre) {
  inst.els.menuPrincipal.dataset.visible = nombre === 'principal' ? '1' : '0';
  inst.els.menuControles.dataset.visible = nombre === 'controles' ? '1' : '0';
  inst.els.menuAcerca.dataset.visible = nombre === 'acerca' ? '1' : '0';
}

// ---- ranking ----------------------------------------------------------------

async function cargarRanking() {
  const e = inst.els;
  e.rankingLista.innerHTML = '';
  e.rankingEstado.textContent = T('rank.cargando');
  if (!ranking.disponible()) { e.rankingEstado.textContent = T('rank.sinConexion'); return; }
  try {
    const filas = await ranking.top(10);
    if (!inst || !e.rankingLista.isConnected) return;
    e.rankingEstado.textContent = filas.length ? '' : T('rank.vacio');
    e.rankingLista.innerHTML = filas.map((f, i) => [
      `<li class="sr-ranking__fila${i === 0 ? ' sr-ranking__fila--top' : ''}">`,
      `  <span class="sr-ranking__pos">${i + 1}</span>`,
      `  <span class="sr-ranking__nombre">${escapar(f.nombre)}</span>`,
      `  <span class="sr-ranking__mec">${escapar(f.mecanica || '')}</span>`,
      `  <span class="sr-ranking__pts">${formatoNumero(f.puntos)} ${T('rank.pts')}</span>`,
      `</li>`
    ].join('')).join('');
  } catch (err) {
    e.rankingEstado.textContent = T('rank.sinConexion');
  }
}

function escapar(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function enviarPuntuacion(ev) {
  ev.preventDefault();
  const g = inst.game;
  const e = inst.els;
  if (!g || g.enviado) return;
  const nombre = ranking.limpiarNombre(e.nombreRanking.value);
  if (!nombre) { e.estadoEnvio.textContent = T('rank.nombreVacio'); return; }
  e.enviarRanking.disabled = true;
  e.estadoEnvio.textContent = T('rank.cargando');
  try {
    await ranking.enviar({ nombre, puntos: g.puntos, cola: g.maxTailAchieved, tiempo: g.runTime, mecanica: g.mecanica.nombre });
    g.enviado = true;
    e.estadoEnvio.textContent = T('rank.enviado');
    sfx.tocar('cobrar', { monedas: 6 });
  } catch (err) {
    e.estadoEnvio.textContent = T('rank.error');
    e.enviarRanking.disabled = false;
  }
}

function mostrarControles(ver) { mostrarPanel(ver ? 'controles' : 'principal'); }

function panelActual() {
  if (inst.els.menuControles.dataset.visible === '1') return 'controles';
  if (inst.els.menuAcerca.dataset.visible === '1') return 'acerca';
  return 'principal';
}

function mostrarSeleccion() {
  const g = inst.game;
  if (!g) return;
  g.state = 'seleccion';
  inst.els.modalMenu.dataset.visible = '0';
  inst.els.modalSummary.dataset.visible = '0';
  inst.els.modalLevelup.dataset.visible = '0';
  inst.oferta = generarOferta();
  pintarOferta();
}

function pintarOferta() {
  inst.els.mecanicasGrid.innerHTML = inst.oferta.map((lista, i) => {
    const reglas = fusionarMecanicas(lista);
    const bloques = lista.length ? lista.map((m) => [
      `<div class="sr-card__bloque">`,
      `  <div class="sr-card__icon">${ico(m.icon, 'sr-ico--carta')}</div>`,
      `  <div class="sr-card__name">${T('mec.' + m.id + '.name', null, m.name)}</div>`,
      `  <div class="sr-card__desc">${T('mec.' + m.id + '.desc', null, m.desc)}</div>`,
      `</div>`
    ].join('\n')).join('\n<div class="sr-card__mas">+</div>\n') : [
      `<div class="sr-card__bloque">`,
      `  <div class="sr-card__icon">${ico('serpiente', 'sr-ico--carta')}</div>`,
      `  <div class="sr-card__name">${T('sel.clasica')}</div>`,
      `  <div class="sr-card__desc">${T('sel.clasicaD')}</div>`,
      `</div>`
    ].join('\n');
    return [
      `<div class="sr-card sr-card--mecanica${lista.length ? ' sr-card--doble' : ''}" data-oferta="${i}">`,
      bloques,
      `  <div class="sr-card__badge">${T('sel.bote', { n: i + 1, m: reglas.mult })}</div>`,
      `</div>`
    ].join('\n');
  }).join('\n');
  inst.els.modalMecanica.dataset.visible = '1';
  updateHUD();
}

function elegirOferta(indice) {
  if (!inst.game || inst.game.state !== 'seleccion' || !inst.oferta) return;
  const lista = inst.oferta[indice];
  if (!lista) return;
  inst.els.modalMecanica.dataset.visible = '0';
  initGame(lista);
  const g = inst.game;
  inst.els.footerMecanica.textContent = g.mecanica.nombre;
  addFloater(T('sel.elegida', { nombre: g.mecanica.nombre.toUpperCase(), m: g.mecanica.mult }), g.w / 2, g.h / 3, '#FFD54F', { tam: 15, glow: 12 });
  spawnParticleBurst(g.w / 2, g.h / 3, '#FFD54F', 24);
  sfx.tocar('carta');
  fx.flash(g, fx.CIAN, 0.2, 0.4);
}

// ---- fin de run y récords -------------------------------------------------

function gameOver(reason) {
  const g = inst.game;
  g.state = 'game_over';

  // El bote en juego se pierde al morir... salvo con Manos de Diamante
  let notaBote = '';
  if (g.bote > 0) {
    const diamante = stacksDe(g, 'manos_diamante');
    if (diamante > 0) {
      const fraccion = Math.min(1, 0.5 + 0.25 * (diamante - 1));
      const rescatado = Math.round(g.bote * fraccion);
      g.puntos += rescatado;
      notaBote = T('fin.boteRescatado', { r: rescatado, b: g.bote, p: Math.round(fraccion * 100) });
    } else {
      notaBote = T('fin.botePerdido', { b: g.bote });
    }
    g.bote = 0;
  }

  if (g.puntos > records.puntos) records.puntos = g.puntos;
  if (g.maxTailAchieved > records.cola) records.cola = g.maxTailAchieved;

  const len = g.maxTailAchieved;
  const rank = T(len >= 80 ? 'rango.80' : len >= 55 ? 'rango.55' : len >= 35 ? 'rango.35' : len >= 20 ? 'rango.20' : 'rango.0');

  inst.els.summaryTitle.textContent = reason;
  inst.els.summaryRank.textContent = T('fin.rango', { r: rank });
  inst.els.statLength.textContent = T('fin.casillas', { n: len });
  inst.els.statFruits.textContent = `${g.fruitsEaten}`;
  inst.els.statVaults.textContent = `${g.vaultCount}`;
  inst.els.statTime.textContent = `${Math.round(g.runTime)}s`;

  inst.els.statPuntos.textContent = `${g.puntos}`;
  inst.els.statJackpot.textContent = T('fin.tiradasV', { t: g.tiradas, x: g.triples });
  inst.els.statRacha.textContent = `x${multiplicadorRacha(g.rachaMax).toFixed(2)}`;
  inst.els.summaryBote.textContent = notaBote;
  g.enviado = false;
  inst.els.formRanking.dataset.visible = ranking.disponible() ? '1' : '0';
  inst.els.nombreRanking.value = ranking.nombreGuardado();
  inst.els.enviarRanking.disabled = false;
  inst.els.estadoEnvio.textContent = '';
  inst.els.footerRecord.innerHTML = '';
  inst.els.footerRecord.append(inst.els.footerMecanica, ' · ' + T('pie.record', { pts: records.puntos, cola: records.cola }));
  inst.els.modalSummary.dataset.visible = '1';
}

// ---- partículas y floaters ------------------------------------------------

function spawnParticleBurst(x, y, color, count) {
  const g = inst.game;
  if (!g) return;
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 30 + Math.random() * 120;
    g.particles.push({
      x, y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      life: 0.4 + Math.random() * 0.35,
      maxLife: 0.75,
      radius: 2 + Math.random() * 3,
      color
    });
  }
  if (g.particles.length > 260) g.particles.splice(0, g.particles.length - 260);
}

// Sin emojis en el canvas: los textos flotantes se limpian al entrar. Los
// iconos del juego son vectores; en el canvas hablan el color y el tamaño.
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;

function addFloater(text, x, y, color = '#FFF', opts = {}) {
  const g = inst.game;
  if (!g) return;
  const limpio = String(text).replace(EMOJI_RE, '').replace(/\s{2,}/g, ' ').replace(/\s+\)/g, ')').trim();
  const dur = opts.dur || 1.1;
  g.floaters.push({
    text: limpio, x, y,
    vy: opts.vy !== undefined ? opts.vy : -35,
    life: dur,
    maxLife: dur,
    color,
    tam: opts.tam || 12,
    glow: opts.glow !== undefined ? opts.glow : 6,
    edad: 0
  });
  if (g.floaters.length > 18) g.floaters.shift();
}

function updateParticles(dt) {
  const g = inst.game;
  if (!g.particles) return;
  for (let i = g.particles.length - 1; i >= 0; i--) {
    const p = g.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      g.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

function updateFloaters(dt) {
  const g = inst.game;
  if (!g.floaters) return;
  for (let i = g.floaters.length - 1; i >= 0; i--) {
    const f = g.floaters[i];
    f.life -= dt;
    f.edad += dt;
    if (f.life <= 0) {
      g.floaters.splice(i, 1);
      continue;
    }
    f.y += f.vy * dt;
  }
}

// ---- renderizado en Canvas 2D ---------------------------------------------

function render() {
  if (!inst || !inst.ctx2d) return;
  const c = inst.ctx2d;
  const g = inst.game;
  if (!g) return;

  const w = g.w;
  const h = g.h;
  const t = g.tile;
  const tiempo = g.tiempo;
  const multRacha = multiplicadorRacha(g.racha);
  const hue = fx.tonoRacha(multRacha, g.frenesiActiva);

  c.save();

  if (g.cameraShake > 0) {
    const sx = (Math.random() - 0.5) * g.cameraShake;
    const sy = (Math.random() - 0.5) * g.cameraShake;
    c.translate(sx, sy);
  }

  // 1-2. Fondo holografico: grilla que late con la racha, scanlines, tinte
  fx.dibujarFondo(c, g, w, h, t, tiempo);

  // 3. Brújula indicadora hacia la fruta
  if (g.fruits.length > 0) {
    renderCompassPointer(c, g);
  }

  // 3b. Haz tractor del imán hacia las frutas dentro del rango
  const magnetRangeHaz = alcanceIman(g);
  if (magnetRangeHaz > 0 && g.snake.length > 0) {
    const head = g.snake[0];
    const hx = (head.x + 0.5) * t;
    const hy = (head.y + 0.5) * t;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.setLineDash([5, 5]);
    c.lineDashOffset = -tiempo * 40;
    for (const f of g.fruits) {
      const d = Math.hypot(head.x - f.x, head.y - f.y);
      if (d <= magnetRangeHaz) {
        c.strokeStyle = g.buff === 'iman' ? 'rgba(255, 213, 79, 0.7)' : 'rgba(0, 229, 255, 0.6)';
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(hx, hy);
        c.lineTo((f.x + 0.5) * t, (f.y + 0.5) * t);
        c.stroke();
      }
    }
    c.restore();
  }

  // 3c. Muros (informacion, no adorno): rojos los que matan, cian el libre
  if (g.mecanica.muros || g.mecanica.muroErrante) {
    const aviso = g.mecanica.muroErrante && g.muroTimer <= MURO_AVISO && Math.floor(g.muroTimer * 8) % 2 === 0;
    const bordes = [
      [0, 1.5, w, 1.5],
      [w - 1.5, 0, w - 1.5, h],
      [0, h - 1.5, w, h - 1.5],
      [1.5, 0, 1.5, h]
    ];
    for (let i = 0; i < 4; i++) {
      const libre = g.mecanica.muroErrante && i === g.muroLibre;
      c.save();
      c.lineWidth = 3;
      c.shadowBlur = 14;
      if (libre) {
        c.strokeStyle = aviso ? fx.ORO : fx.CIAN;
        c.shadowColor = c.strokeStyle;
        c.setLineDash([10, 8]);
        c.lineDashOffset = -tiempo * 60;
      } else {
        c.strokeStyle = fx.ROJO;
        c.shadowColor = fx.ROJO;
      }
      c.beginPath();
      c.moveTo(bordes[i][0], bordes[i][1]);
      c.lineTo(bordes[i][2], bordes[i][3]);
      c.stroke();
      c.restore();
    }
  }

  // 4. Frutas en la arena (con cuenta atras si son fugaces)
  for (const f of g.fruits) {
    renderFruit(c, f, t, tiempo);
    if (g.mecanica.frutasFugaces) {
      const resta = Math.max(0, 1 - (g.runTime - f.birthTime) / g.mecanica.frutasFugaces);
      c.save();
      c.strokeStyle = resta < 0.3 ? fx.ROJO : 'rgba(148, 163, 184, 0.9)';
      c.lineWidth = 2;
      c.beginPath();
      c.arc((f.x + 0.5) * t, (f.y + 0.5) * t, t * 0.66, -Math.PI / 2, -Math.PI / 2 + TAU * resta);
      c.stroke();
      c.restore();
    }
  }

  // 4b. Artefactos: glifo por tipo, anillo de cuenta atras, portal con su hilo
  for (const a of g.artefactos) {
    if (a.tipo === 'portal' && a.par && a.par.x > a.x) continue; // el hilo se dibuja una vez
    if (a.tipo === 'portal' && a.par) {
      c.save();
      c.strokeStyle = 'rgba(224, 64, 251, 0.35)';
      c.setLineDash([3, 7]);
      c.lineDashOffset = -tiempo * 30;
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo((a.x + 0.5) * t, (a.y + 0.5) * t);
      c.lineTo((a.par.x + 0.5) * t, (a.par.y + 0.5) * t);
      c.stroke();
      c.restore();
    }
  }
  for (const a of g.artefactos) fx.dibujarArtefacto(c, a, t, tiempo, colorArtefacto(a.tipo), a.vida / ARTEFACTO_VIDA);

  // 5-6. Rastro, cuerpo y cabeza de la serpiente
  fx.dibujarRastro(c, g, t, hue);
  renderSnakeBody(c, g, t, hue);
  renderSnakeHead(c, g, t, hue, tiempo);

  // 6b. Inanicion: la cola que queda, en rojo sobre la cabeza, imposible de no ver
  if (g.inanicion > 0 && g.snake.length) {
    const head = g.snake[0];
    const pulso = 1 + 0.25 * Math.max(0, Math.sin(tiempo * 14));
    const texto = g.inanicion < INANICION_GRACIA ? T('f.come') : T('f.colaN', { n: g.snake.length });
    fx.textoBrillante(c, texto, (head.x + 0.5) * t, (head.y + 0.5) * t - 30, { color: fx.ROJO, tam: 20 * pulso, glow: 18 });
  }

  // 7. Ondas de choque, monedas y partículas (aditivas: brillan, no tapan)
  fx.dibujarOndas(c, g);
  fx.dibujarMonedas(c, g);
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const p of g.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    c.fillStyle = p.color;
    c.globalAlpha = a;
    c.beginPath();
    c.arc(p.x, p.y, p.radius * (0.5 + a), 0, TAU);
    c.fill();
  }
  c.restore();

  // 8. Textos flotantes: entran con un golpe de escala y brillan
  for (const f of g.floaters) {
    const alpha = Math.max(0, Math.min(1, f.life / f.maxLife * 1.6));
    const pop = 1 + 0.7 * Math.max(0, 1 - f.edad / 0.14);
    fx.textoBrillante(c, f.text, f.x, f.y, { color: f.color, tam: f.tam * pop, alfa: alpha, glow: f.glow });
  }

  // 9. Vitrina: viñeta, borde de estado, flash e impacto
  fx.dibujarVineta(c, g, w, h);
  fx.dibujarBorde(c, g, w, h, tiempo);
  fx.dibujarFlash(c, g, w, h);

  c.restore();

  // 10. Muriendo: el holograma se rompe (fuera del translate del shake)
  if (g.state === 'muriendo') {
    fx.dibujarGlitch(c, inst.canvas, Math.min(1, 0.4 + g.muerteTimer));
  }
}

function renderCompassPointer(c, g) {
  const head = g.snake[0];
  const hx = (head.x + 0.5) * g.tile;
  const hy = (head.y + 0.5) * g.tile;

  c.save();
  c.translate(hx, hy);
  c.rotate(g.compassAngle);

  // Haz holográfico tenue apuntando a la fruta
  const grad = c.createLinearGradient(0, 0, 45, 0);
  grad.addColorStop(0, 'rgba(0, 229, 255, 0.4)');
  grad.addColorStop(1, 'rgba(0, 229, 255, 0)');
  c.fillStyle = grad;
  c.beginPath();
  c.moveTo(10, -4);
  c.lineTo(45, 0);
  c.lineTo(10, 4);
  c.closePath();
  c.fill();

  c.restore();
}

function renderFruit(c, f, t, tiempo) {
  const cx = (f.x + 0.5) * t;
  const cy = (f.y + 0.5) * t;
  const pulse = Math.sin(tiempo * 5 + f.x) * 1.4;
  const r = t * 0.34 + pulse;

  let color = fx.VERDE;
  if (f.type === 'hyper') color = fx.ROJO;
  else if (f.type === 'phase') color = fx.VIOLETA;
  else if (f.type === 'mutant') color = fx.ORO;

  c.save();
  c.translate(cx, cy);

  // Halo aditivo
  c.globalCompositeOperation = 'lighter';
  const halo = c.createRadialGradient(0, 0, r * 0.3, 0, 0, r + 9);
  halo.addColorStop(0, color);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  c.globalAlpha = 0.35;
  c.fillStyle = halo;
  c.beginPath();
  c.arc(0, 0, r + 9, 0, TAU);
  c.fill();
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';

  // Rombo holografico girando alrededor del nucleo
  c.save();
  c.rotate(tiempo * (f.type === 'mutant' ? 2.2 : 1.1) + f.y);
  c.strokeStyle = color;
  c.lineWidth = 1.5;
  c.globalAlpha = 0.85;
  const d = r + 5;
  c.beginPath();
  c.moveTo(0, -d); c.lineTo(d, 0); c.lineTo(0, d); c.lineTo(-d, 0); c.closePath();
  c.stroke();
  if (f.type === 'mutant') {
    // La ficha: segundo rombo en contrafase y marcas de tragaperras
    c.rotate(Math.PI / 4);
    c.globalAlpha = 0.5;
    c.beginPath();
    c.moveTo(0, -d - 3); c.lineTo(d + 3, 0); c.lineTo(0, d + 3); c.lineTo(-d - 3, 0); c.closePath();
    c.stroke();
  }
  c.restore();

  // Nucleo
  const nucleo = c.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
  nucleo.addColorStop(0, '#FFFFFF');
  nucleo.addColorStop(0.35, color);
  nucleo.addColorStop(1, fx.hsl(0, 0, 8, 0.9));
  c.fillStyle = nucleo;
  c.beginPath();
  c.arc(0, 0, r, 0, TAU);
  c.fill();
  c.strokeStyle = color;
  c.lineWidth = 1.2;
  c.beginPath();
  c.arc(0, 0, r, 0, TAU);
  c.stroke();

  // Chispa orbital
  const a = tiempo * 3.5 + f.x * 0.7;
  c.fillStyle = '#FFFFFF';
  c.globalAlpha = 0.9;
  c.beginPath();
  c.arc(Math.cos(a) * (r + 5), Math.sin(a) * (r + 5), 1.6, 0, TAU);
  c.fill();

  c.restore();
}

function renderSnakeBody(c, g, t, hue) {
  const snake = g.snake;
  const total = snake.length;
  const frenesi = g.frenesiActiva;

  for (let i = total - 1; i >= 1; i--) {
    const s = snake[i];
    const ratio = i / total;
    const baseR = (t * 0.40) * (1 - ratio * 0.3);
    const jumpElev = (s.jump || 0) * 4;
    const cx = (s.x + 0.5) * t;
    const cy = (s.y + 0.5) * t - jumpElev;
    const h = hue + ratio * 45;
    const luz = 30 + (1 - ratio) * 16;

    // Sombra del salto
    if (s.jump > 0) {
      c.fillStyle = 'rgba(0, 0, 0, 0.45)';
      c.beginPath();
      c.arc(cx, cy + jumpElev + 2, baseR, 0, TAU);
      c.fill();
    }

    // Halo aditivo suave
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = fx.hsl(h, 100, 55, frenesi ? 0.22 : 0.09 + 0.09 * (1 - ratio));
    c.beginPath();
    c.arc(cx, cy, baseR + 4, 0, TAU);
    c.fill();
    c.restore();

    // Cuerpo: disco oscuro con anillo de luz
    c.fillStyle = fx.hsl(h, 90, luz);
    c.beginPath();
    c.arc(cx, cy, baseR, 0, TAU);
    c.fill();
    c.strokeStyle = fx.hsl(h, 100, 68, 0.95);
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(cx, cy, baseR - 1, 0, TAU);
    c.stroke();

    // Vertebra luminosa cada tres segmentos
    if (i % 3 === 0) {
      c.fillStyle = fx.hsl(h, 100, 88, 0.85);
      c.beginPath();
      c.arc(cx, cy, baseR * 0.26, 0, TAU);
      c.fill();
    }

    if (s.jump > 0) {
      c.strokeStyle = fx.CIAN;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(cx, cy, baseR + 3, 0, TAU);
      c.stroke();
    }
  }
}

function renderSnakeHead(c, g, t, hue, tiempo) {
  const head = g.snake[0];
  const cx = (head.x + 0.5) * t;
  const cy = (head.y + 0.5) * t;
  const jumpElev = (head.jump || 0) * 5;
  const color = fx.hsl(hue, 100, 62);
  const invencible = g.buff === 'escudo';

  c.save();
  c.translate(cx, cy - jumpElev);

  // Halo de la cabeza: crece con la racha, late en frenesí
  c.save();
  c.globalCompositeOperation = 'lighter';
  const rHalo = t * (0.75 + Math.min(0.5, g.racha * 0.03)) + (g.frenesiActiva ? 4 * Math.sin(tiempo * 12) : 0);
  const halo = c.createRadialGradient(0, 0, t * 0.2, 0, 0, rHalo);
  halo.addColorStop(0, fx.hsl(hue, 100, 70, 0.55));
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = halo;
  c.beginPath();
  c.arc(0, 0, rHalo, 0, TAU);
  c.fill();
  c.restore();

  // Escudo invencible: anillo verde girando
  if (invencible) {
    c.save();
    c.rotate(tiempo * 4);
    c.strokeStyle = fx.VERDE;
    c.lineWidth = 2.5;
    c.setLineDash([9, 6]);
    c.shadowColor = fx.VERDE;
    c.shadowBlur = 12;
    c.beginPath();
    c.arc(0, 0, t * 0.72, 0, TAU);
    c.stroke();
    c.restore();
  }

  const ang = Math.atan2(g.dir.y, g.dir.x);
  c.rotate(ang);

  if (head.jump > 0) {
    c.strokeStyle = fx.CIAN;
    c.lineWidth = 3;
    c.beginPath();
    c.arc(0, 0, t * 0.65, 0, TAU);
    c.stroke();
  }

  // Cabeza aerodinamica con brillo
  c.shadowColor = color;
  c.shadowBlur = 16;
  c.fillStyle = color;
  c.beginPath();
  c.arc(0, 0, t * 0.48, Math.PI * 0.5, Math.PI * 1.5);
  c.lineTo(t * 0.56, 0);
  c.closePath();
  c.fill();
  c.shadowBlur = 0;

  // Nucleo interior mas oscuro y visor
  c.fillStyle = fx.hsl(hue, 90, 22);
  c.beginPath();
  c.arc(-t * 0.05, 0, t * 0.3, Math.PI * 0.5, Math.PI * 1.5);
  c.lineTo(t * 0.36, 0);
  c.closePath();
  c.fill();

  c.fillStyle = g.frenesiActiva ? '#FFFFFF' : fx.hsl(hue, 100, 85);
  c.fillRect(t * 0.08, -t * 0.28, t * 0.2, t * 0.14);
  c.fillRect(t * 0.08, t * 0.14, t * 0.2, t * 0.14);

  c.restore();
}

// ---- interfaz y HUD -------------------------------------------------------

// Miles con punto, como se leen en español: 37 581 -> "37.581"
function formatoNumero(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function updateHUD() {
  const g = inst.game;
  const e = inst.els;
  if (!g || !e.energyBar) return;

  const energyPct = Math.max(0, Math.min(100, (g.energy / g.maxEnergy) * 100));
  e.energyBar.style.width = `${energyPct}%`;

  let status = 'normal';
  if (energyPct < 22) status = 'critical';
  else if (energyPct < 45) status = 'warning';
  e.energyBar.dataset.status = status;

  e.energyText.textContent = g.inanicion > 0 ? `${T('hud.inanicion')} -${g.inanicionPerdidos}` : `${Math.round(g.energy)}/${g.maxEnergy}`;
  e.energyText.dataset.inanicion = g.inanicion > 0 ? '1' : '0';

  const tailLen = g.snake.length;
  const totalDrainVal = calcularGasto(g);
  e.drainText.textContent = `−${totalDrainVal.toFixed(1)}/s`;

  e.lengthText.textContent = `${tailLen}`;
  e.scoreText.textContent = `${g.fruitsEaten}`;

  // Barra visual de experiencia para el próximo nivel
  const xpPct = Math.max(0, Math.min(100, (g.xp / g.xpNext) * 100));
  if (e.xpBar) e.xpBar.style.width = `${xpPct}%`;
  const xpRemaining = Math.max(0, g.xpNext - g.xp);
  if (e.xpText) e.xpText.textContent = `${g.xp}/${g.xpNext}`;
  if (e.xpLevelText) e.xpLevelText.textContent = `${g.level}`;

  // Fila de apuesta
  const multRacha = multiplicadorRacha(g.racha);
  e.rachaText.textContent = g.racha > 0 ? `×${multRacha.toFixed(2)}` : '×1.00';
  e.rachaText.dataset.n = g.racha > 1 ? String(g.racha) : '';
  e.rachaBar.style.width = g.racha > 0 ? `${Math.max(0, Math.min(100, (g.rachaTimer / g.rachaVentana) * 100))}%` : '0%';

  e.frenesiBar.style.width = `${Math.round(g.frenesi * 100)}%`;
  e.frenesiBar.dataset.activa = g.frenesiActiva ? '1' : '0';
  if (g.frenesiActiva) e.frenesiText.textContent = `${g.frenesiTimer.toFixed(1)}s`;
  else if (g.bajonTimer > 0) e.frenesiText.textContent = `${T('hud.bajon')} ${g.bajonTimer.toFixed(1)}s`;
  else e.frenesiText.textContent = '';
  e.frenesiText.dataset.estado = g.frenesiActiva ? 'frenesi' : g.bajonTimer > 0 ? 'bajon' : '';

  e.lev.textContent = `×${g.apalancamiento}`;
  e.lev.dataset.riesgo = g.apalancamiento >= LIQUIDACION_DESDE ? '1' : '0';
  e.bote.textContent = formatoNumero(g.bote);
  e.puntos.textContent = formatoNumero(g.puntos);
  if (e.fichas) e.fichas.textContent = `${g.jackpotFichas}/${JACKPOT_FRUTAS}`;
  if (e.buff) {
    const txt = g.buff ? `${nombreSimbolo(simboloDe(g.buff))} ${g.buffTimer.toFixed(1)}s` : '';
    if (e.buff.dataset.txt !== txt) {
      e.buff.dataset.txt = txt;
      e.buff.innerHTML = g.buff ? ico(simboloDe(g.buff).icon, 'sr-ico--hud') + ' ' + txt : '';
    }
  }

  // Sensaciones del HUD: la racha crece de tamaño y cambia de color, el bote y
  // los puntos dan un golpe al subir, el frenesí enciende la fila de apuesta.
  const multHud = multiplicadorRacha(g.racha);
  e.rachaText.style.fontSize = `${12 + Math.min(8, g.racha * 0.6)}px`;
  e.rachaText.style.color = fx.hsl(fx.tonoRacha(multHud, g.frenesiActiva), 100, 70);
  e.bote.style.transform = `scale(${(1 + 0.3 * g.botePop).toFixed(3)})`;
  e.puntos.style.transform = `scale(${(1 + 0.35 * g.puntosPop).toFixed(3)})`;
  if (e.hud) {
    e.hud.dataset.frenesi = g.frenesiActiva ? '1' : '0';
    e.hud.dataset.bajon = g.bajonTimer > 0 ? '1' : '0';
    e.hud.dataset.inanicion = g.inanicion > 0 ? '1' : '0';
    e.hud.dataset.buff = g.buff ? '1' : '0';
  }
  if (e.menuHolo && g.state === 'menu') {
    e.menuHolo.style.transform = `rotate(${(g.tiempo * 9).toFixed(1)}deg)`;
  }
  if (e.footerMecanica) {
    const txtMec = g.mecanica.nombre + (g.vidasExtra > 0 ? ' +1' : '');
    if (e.footerMecanica.dataset.txt !== txtMec) {
      e.footerMecanica.dataset.txt = txtMec;
      e.footerMecanica.innerHTML = g.mecanica.nombre + (g.vidasExtra > 0 ? ' ' + ico('vida', 'sr-ico--hud') : '');
    }
  }
}

// ---- eventos e interacción ------------------------------------------------

function onClick(ev) {
  if (!inst || !inst.game) return;
  sfx.activar();
  musica.activar();
  const tgt = ev.target;

  const card = tgt.closest('.sr-card');
  if (card && card.dataset.perk) {
    selectPerk(card.dataset.perk);
    return;
  }
  if (card && card.dataset.oferta !== undefined) {
    elegirOferta(Number(card.dataset.oferta));
    return;
  }

  const boton = tgt.closest('[data-act]');
  const act = boton ? boton.dataset.act : undefined;
  if (act === 'sonido') {
    alternarSonido();
    return;
  }
  if (act === 'idioma') {
    alternarIdiomaUI();
    return;
  }
  if (act === 'rebobinar') {
    if (inst.game.state === 'seleccion') { sfx.tocar('carta'); mostrarSeleccion(); }
    return;
  }
  if (act) sfx.tocar('clic');
  if (act === 'restart' || act === 'jugar') {
    // La siguiente run vuelve a elegir mecanica
    mostrarSeleccion();
  } else if (act === 'menu') {
    mostrarMenu();
  } else if (act === 'controles') {
    mostrarControles(true);
  } else if (act === 'acerca') {
    mostrarPanel('acerca');
  } else if (act === 'volver') {
    mostrarControles(false);
  }
}

function alternarSonido() {
  const silenciado = sfx.silenciar();
  musica.silenciar(silenciado);
  if (inst && inst.els.botonSonido) {
    inst.els.botonSonido.innerHTML = ico(silenciado ? 'silencio' : 'sonido');
    inst.els.botonSonido.dataset.silenciado = silenciado ? '1' : '0';
  }
}

function onKeyDown(ev) {
  if (!inst || !inst.game) return;
  sfx.activar();
  musica.activar();
  const g = inst.game;

  // Escribiendo el nombre: el teclado es del campo, no del juego
  if (ev.target && ev.target.tagName === 'INPUT') return;

  if (ev.key === 'm' || ev.key === 'M') {
    alternarSonido();
    ev.preventDefault();
    return;
  }

  // Menu principal: Enter/Espacio juega, Escape cierra los controles
  if (g.state === 'menu') {
    if (ev.key === 'l' || ev.key === 'L') { alternarIdiomaUI(); ev.preventDefault(); return; }
    const enControles = panelActual() !== 'principal';
    if (ev.key === 'Escape') { mostrarPanel('principal'); ev.preventDefault(); }
    else if (!enControles && (ev.key === 'Enter' || ev.code === 'Space')) { mostrarSeleccion(); ev.preventDefault(); }
    return;
  }

  // En la seleccion de mecanica, los numeros eligen; Escape vuelve al menu
  if (g.state === 'seleccion') {
    if (ev.key === 'Escape') { mostrarMenu(); ev.preventDefault(); return; }
    if (ev.key === 'r' || ev.key === 'R') { sfx.tocar('carta'); mostrarSeleccion(); ev.preventDefault(); return; }
    if (ev.key === 'l' || ev.key === 'L') { alternarIdiomaUI(); ev.preventDefault(); return; }
    if (ev.key >= '1' && ev.key <= '3' && ev.key.length === 1) {
      elegirOferta(Number(ev.key) - 1);
      ev.preventDefault();
    }
    return;
  }

  if (ev.code === 'Space' || ev.key === 'Shift') {
    g.dashing = true;
    ev.preventDefault();
    return;
  }

  // Apuesta: 1-5 fija el apalancamiento, Q/E lo baja/sube, C cobra el bote
  if (ev.key === 'c' || ev.key === 'C') {
    cobrarBote();
    ev.preventDefault();
    return;
  }
  if (ev.key >= '1' && ev.key <= '5' && ev.key.length === 1) {
    const niveles = nivelesDisponibles(g);
    const nivel = niveles[Number(ev.key) - 1];
    if (nivel !== undefined) setApalancamiento(nivel);
    ev.preventDefault();
    return;
  }
  if (ev.key === 'e' || ev.key === 'E' || ev.key === 'q' || ev.key === 'Q') {
    const niveles = nivelesDisponibles(g);
    const i = niveles.indexOf(g.apalancamiento);
    const paso = (ev.key === 'e' || ev.key === 'E') ? 1 : -1;
    const nivel = niveles[i + paso];
    if (nivel !== undefined) setApalancamiento(nivel);
    ev.preventDefault();
    return;
  }

  let newDir = null;
  if (ev.key === 'ArrowUp' || ev.key === 'w' || ev.key === 'W') {
    newDir = { x: 0, y: -1 };
  } else if (ev.key === 'ArrowDown' || ev.key === 's' || ev.key === 'S') {
    newDir = { x: 0, y: 1 };
  } else if (ev.key === 'ArrowLeft' || ev.key === 'a' || ev.key === 'A') {
    newDir = { x: -1, y: 0 };
  } else if (ev.key === 'ArrowRight' || ev.key === 'd' || ev.key === 'D') {
    newDir = { x: 1, y: 0 };
  }

  if (newDir) {
    // Evitar girar 180° sobre sí mismo instantáneamente
    const lastDir = g.dirQueue.length > 0 ? g.dirQueue[g.dirQueue.length - 1] : g.dir;
    if (newDir.x !== -lastDir.x || newDir.y !== -lastDir.y) {
      if (g.dirQueue.length < 2) {
        g.dirQueue.push(newDir);
      }
      g.nextDir = newDir;
    }
    ev.preventDefault();
  }
}

function onKeyUp(ev) {
  if (!inst || !inst.game) return;
  if (ev.code === 'Space' || ev.key === 'Shift') {
    inst.game.dashing = false;
  }
}
