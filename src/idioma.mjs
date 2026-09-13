// idioma.mjs — textos del juego en español e inglés.
// T(clave, vars, alternativa): busca la clave en el idioma actual; si no está,
// en español; si tampoco, devuelve `alternativa` (o la clave). Los catálogos
// (cartas, mecánicas, símbolos) llevan su texto en español como fuente y aquí
// sólo viven sus traducciones, con clave `perk.<id>.name`, `mec.<id>.desc`, etc.
// Sin persistencia: el idioma se elige por navegador y se cambia con L.

export const IDIOMAS = ['es', 'en'];

let actual = detectar();

function detectar() {
  try {
    const nav = (navigator.language || 'es').toLowerCase();
    return nav.startsWith('es') ? 'es' : 'en';
  } catch (e) { return 'es'; }
}

export function idioma() { return actual; }

export function setIdioma(id) {
  if (IDIOMAS.indexOf(id) !== -1) actual = id;
  return actual;
}

export function alternarIdioma() {
  return setIdioma(actual === 'es' ? 'en' : 'es');
}

export function T(clave, vars, alternativa) {
  let s = TEXTOS[actual][clave];
  if (s === undefined) s = TEXTOS.es[clave];
  if (s === undefined) s = alternativa !== undefined ? alternativa : clave;
  if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]));
  return s;
}

const ES = {
  // cabecera
  'hud.energia': 'Energía', 'hud.racha': 'Racha', 'hud.frenesi': 'Frenesí', 'hud.nivel': 'Nivel',
  'hud.cola': 'Cola', 'hud.frutas': 'Frutas', 'hud.apalanc': 'Apalanc.', 'hud.bote': 'Bote', 'hud.puntos': 'Puntos',
  'hud.fichasTitulo': 'Tres frutas doradas = una tirada de tragaperras',
  'hud.apalancTitulo': 'Apalancamiento (1-5, Q/E): multiplica el bote, el gasto y el coste del salto; algo más de velocidad. Desde ×3, sin energía = liquidado. Bajar quema el 25 % del bote.',
  'hud.inanicion': 'INANICIÓN', 'hud.bajon': 'bajón',
  // subida de nivel
  'nivel.titulo': '¡MUTACIÓN DESBLOQUEADA!', 'nivel.sub': 'Elige una mejora para tu leviatán biológico:', 'nivel.mejora': 'Nvl {n} (Mejora)',
  // menú
  'menu.jugar': 'JUGAR', 'menu.controles': 'CONTROLES', 'menu.record': 'Récord: {pts} pts · cola {cola}', 'menu.volver': 'VOLVER',
  'menu.idiomaTitulo': 'Idioma (L)', 'menu.acerca': 'ACERCA DE',
  'acerca.titulo': 'ACERCA DE',
  'acerca.texto': "Este es un minijuego que vibecodeé para mi proyecto 'SCP: The Black Silk Road', que incluirá este minijuego. Es un extra, pero se me hizo divertido, así que lo estoy publicando para tener un poco más de actividad mientras sigo desarrollando mi proyecto principal. Apóyame en mi Patreon, ¡y gracias por jugar!",
  'acerca.texto2': "Ya que el juego es vibecodeado y que es simplemente un minijuego para mi proyecto, no tengo problemas si quieres modificar, extraer, reempaquetar o continuar con el minijuego; solo te solicito la auditoría apropiada. El código lo puedes encontrar aquí: {link}",
  'acerca.patreon': 'Apóyame en Patreon',
  'sel.atras': 'ATRÁS', 'rank.titulo': 'TOP 10', 'rank.cargando': 'Cargando…', 'rank.vacio': 'Todavía no hay puntuaciones. ¡Sé el primero!',
  'rank.sinConexion': 'Sin conexión con el ranking.', 'rank.nombre': 'Tu nombre', 'rank.enviar': 'ENVIAR AL RANKING', 'rank.enviado': 'Enviado. ¡Mira el ranking en el menú!',
  'rank.error': 'No se pudo enviar. ¿Sin conexión?', 'rank.nombreVacio': 'Escribe un nombre.', 'rank.pts': 'pts',
  'acerca.creditos': 'Código bajo licencia MIT · Música compuesta por MrPretendo con Strudel · Iconos de Lucide (ISC)',
  'patreon.holo': 'Gracias por jugar, visita mi página para saber más sobre mi proyecto SCP The Black Silk Road',
  // controles
  'ctl.titulo': 'CONTROLES', 'ctl.mover': 'Mover', 'ctl.flechas': 'Flechas', 'ctl.dash': 'Dash turbo', 'ctl.espacio': 'ESPACIO',
  'ctl.cola': 'Pasar sobre tu cola', 'ctl.colaD': 'Salta gastando energía',
  'ctl.sinEnergia': 'Sin energía', 'ctl.sinEnergiaD': 'La cola se quema a toda velocidad — más rápido cuanto más larga llegó a ser, y esa velocidad no baja nunca. Al acabarse, mueres. Desde ×3, sin margen.',
  'ctl.apuesta': 'LA APUESTA', 'ctl.racha': 'Racha', 'ctl.rachaD': 'Encadena frutas y el multiplicador sube. Si tardas, se rompe.',
  'ctl.bote': 'Bote', 'ctl.boteD': 'Lo que entra con racha y apalancamiento. Se pierde al morir.',
  'ctl.cobrarD': 'Cobra el bote tal cual (×1).',
  'ctl.apalancD': 'Apalancamiento ×1 a ×5: multiplica el bote, el gasto y el coste del salto, y da algo más de velocidad. Desde ×3, sin energía = liquidado. Bajar quema el 25 % del bote.',
  'ctl.fichasD': 'Tres frutas doradas = una tirada. Pareja: mejora 9 s. Triple: mejora y bote ×3.',
  'ctl.sonidoD': 'Silenciar / activar el sonido.', 'ctl.idiomaD': 'Cambiar idioma.',
  // tragaperras
  'slot.titulo': 'TRAGAPERRAS', 'slot.sub': 'Pareja: mejora de 9 s. Triple: la mejora y el bote ×3.',
  'slot.triple': '¡¡TRIPLE!! {nombre} {s}s · BOTE ×3 COBRADO: +{pago}', 'slot.pareja': 'PAREJA: {nombre} {s}s — {desc}',
  'slot.nada': 'CASI… CONSUELO: +{n} DE ENERGÍA', 'slot.consuelo': 'CONSUELO +{n}', 'slot.tripleFloat': 'TRIPLE · BOTE ×3 COBRADO',
  // selección de mecánica
  'sel.titulo': 'ELIGE TU MECÁNICA SUPERIOR', 'sel.sub': 'Una regla para toda la run.', 'sel.clasica': 'Clásica', 'sel.clasicaD': 'Sin reglas extra.',
  'sel.bote': '{n} · Bote x{m}', 'sel.rebobinar': 'REBOBINAR', 'sel.elegida': '{nombre} · BOTE x{m}',
  // fin de run
  'fin.titulo': 'FIN DE LA RUN', 'fin.puntos': 'PUNTOS', 'fin.rango': 'Rango Alcanzado: {r}', 'fin.colaMax': 'Cola máxima', 'fin.casillas': '{n} casillas',
  'fin.frutas': 'Frutas', 'fin.saltos': 'Saltos de cola', 'fin.tiradas': 'Tiradas', 'fin.tiradasV': '{t} ({x} triples)', 'fin.rachaMax': 'Racha máxima',
  'fin.tiempo': 'Tiempo', 'fin.otra': '¡OTRA RUN!', 'fin.menu': 'MENÚ',
  'fin.boteRescatado': 'Manos de Diamante rescató {r} de los {b} del bote ({p}%).', 'fin.botePerdido': 'Se perdieron {b} puntos que estaban en el bote sin cobrar.',
  'rango.0': 'Víbora de Neón', 'rango.20': 'Cobra de Plasma', 'rango.35': 'Pitón Hipercinética', 'rango.55': 'Leviatán Alfa', 'rango.80': 'Ouroboros Cósmico (Legendario)',
  // pie
  'pie.mover': 'Mover', 'pie.flechas': 'Flechas', 'pie.turbo': 'Turbo', 'pie.espacio': 'ESPACIO', 'pie.apalancar': 'Apalancar', 'pie.cobrar': 'Cobrar bote',
  'pie.cruzar': 'Cruzar la cola gasta energía', 'pie.record': 'Récord: {pts} pts · cola {cola}', 'pie.sonido': 'Sonido (M)',
  // muertes
  'muerte.liquidado': '¡LIQUIDADO A x{n}!', 'muerte.muro': '¡CONTRA EL MURO!', 'muerte.cola': '¡COLA TOCADA!',
  'muerte.salto': '¡COLISIÓN: ENERGÍA INSUFICIENTE PARA SALTAR!', 'muerte.inanicion': '¡INANICIÓN: COLA AGOTADA!',
  // flotantes
  'f.sinEnergia': '¡SIN ENERGÍA! LA COLA SE QUEMA', 'f.come': '¡COME!', 'f.colaN': 'COLA {n}', 'f.aTiempo': 'A TIEMPO', 'f.aTiempoCola': 'A TIEMPO · -{n} COLA',
  'f.muroAviso': 'EL MURO LIBRE VA A SALTAR…', 'f.muroLibre': 'MURO LIBRE: {m}',
  'muro.0': 'ARRIBA', 'muro.1': 'DERECHA', 'muro.2': 'ABAJO', 'muro.3': 'IZQUIERDA',
  'f.frutaPerdidaRacha': 'FRUTA PERDIDA: RACHA ROTA (x{m})', 'f.frutaPerdida': 'FRUTA PERDIDA', 'f.finBuff': 'FIN: {n}',
  'f.saltoGratis': '¡SALTO DE FASE GRATIS!', 'f.rebote': '¡REBOTE ELÁSTICO! +{n}', 'f.salto': '-{n} (¡SALTO!)', 'f.segundaVida': '¡SEGUNDA VIDA!',
  'f.absorcion': '¡ABSORCIÓN MAGNÉTICA!', 'f.ficha': 'FICHA {a}/{b} · +{e} ENERGÍA (+{x} XP)', 'f.cristal': '¡CRISTAL DE FASE: 2 SALTOS! (+{x} XP)',
  'f.hiper': '¡HIPER-NUTRICIÓN! +{e} (+{x} XP)', 'f.normal': '+{e} (+{g} COLA) [+{x} XP]', 'f.alBote': '+{n} AL BOTE', 'f.rachaPerdida': 'RACHA PERDIDA (x{m})',
  'f.apalancamiento': 'APALANCAMIENTO x{n}{aviso}', 'f.liquidadoAviso': ' · SIN ENERGÍA = LIQUIDADO', 'f.cerrarPosicion': 'CERRAR POSICIÓN: -{n} DEL BOTE',
  'f.todoApalancado': 'TODO APALANCADO: NO SE BAJA DE x{n}', 'f.cobrado': 'COBRADO', 'f.volatil': 'BOTE VOLÁTIL: SÓLO EL JACKPOT PAGA',
  'f.buff': '{n} · {s}s', 'f.frenesi': '¡¡FRENESÍ!!', 'f.frenesiSub': 'MEDIO GASTO · +30% VELOCIDAD · BOTE x2', 'f.frenesiFinResaca': 'FIN DEL FRENESÍ · SIN RESACA',
  'f.bajon': 'BAJÓN: GASTO x{g} DURANTE {s}s', 'f.mutacion': '¡MUTACIÓN ASIMILADA!', 'f.degen': '¡MODO DEGEN! APALANCAMIENTO x{n} EN LA TECLA 5',
  'f.sinResaca': '¡SIN RESACA!', 'f.bateria': '¡BATERÍA NIVEL {n}! (MÁX: {m})', 'f.frutas': '¡FRUTAS MÚLTIPLES NIVEL {n}! (Total: {t} frutas)',
  'f.fantasma': '¡SALTOS FANTASMA +3! (TOTAL: {n})', 'f.hito': 'RACHA {n}',
  'f.portal': '¡PORTAL!', 'f.impulso': '¡IMPULSO! {s}s SIN GASTO', 'f.barrido': '¡BARRIDO! +{n} FRUTAS', 'f.artefactoEuforia': '¡EUFORIA!',
  'ctl.artefactos': 'Artefactos', 'ctl.artefactosD': 'Aparecen en la arena y duran 15 s: portal (A ↔ B), impulso (5 s de velocidad sin gasto), barrido (tira de las frutas y las duplica) y euforia (frenesí al instante).'
};

const EN = {
  'hud.energia': 'Energy', 'hud.racha': 'Streak', 'hud.frenesi': 'Frenzy', 'hud.nivel': 'Level',
  'hud.cola': 'Tail', 'hud.frutas': 'Fruits', 'hud.apalanc': 'Leverage', 'hud.bote': 'Pot', 'hud.puntos': 'Score',
  'hud.fichasTitulo': 'Three golden fruits = one slot spin',
  'hud.apalancTitulo': 'Leverage (1-5, Q/E): multiplies the pot, the drain and the jump cost; a bit more speed. From ×3, no energy = liquidated. Lowering burns 25% of the pot.',
  'hud.inanicion': 'STARVING', 'hud.bajon': 'crash',
  'nivel.titulo': 'MUTATION UNLOCKED!', 'nivel.sub': 'Choose an upgrade for your biological leviathan:', 'nivel.mejora': 'Lv {n} (Upgrade)',
  'menu.jugar': 'PLAY', 'menu.controles': 'CONTROLS', 'menu.record': 'Best: {pts} pts · tail {cola}', 'menu.volver': 'BACK',
  'menu.idiomaTitulo': 'Language (L)', 'menu.acerca': 'ABOUT',
  'acerca.titulo': 'ABOUT',
  'acerca.texto': "This is a minigame I vibe-coded for my project 'SCP: The Black Silk Road', which will include it. It's an extra, but it turned out to be fun, so I'm publishing it to have a bit more going on while I keep developing the main project. Support me on Patreon, and thanks for playing!",
  'acerca.texto2': "Since the game is vibe-coded and is simply a minigame for my project, I have no problem with you modifying, extracting, repackaging or continuing it; I only ask for the appropriate audit. You can find the code here: {link}",
  'acerca.patreon': 'Support me on Patreon',
  'sel.atras': 'BACK', 'rank.titulo': 'TOP 10', 'rank.cargando': 'Loading…', 'rank.vacio': 'No scores yet. Be the first!',
  'rank.sinConexion': 'No connection to the leaderboard.', 'rank.nombre': 'Your name', 'rank.enviar': 'SUBMIT SCORE', 'rank.enviado': 'Sent. Check the leaderboard in the menu!',
  'rank.error': 'Could not send. Offline?', 'rank.nombreVacio': 'Type a name.', 'rank.pts': 'pts',
  'acerca.creditos': 'Code under the MIT license · Music composed by MrPretendo with Strudel · Icons by Lucide (ISC)',
  'patreon.holo': 'Thanks for playing — visit my page to learn more about my project SCP The Black Silk Road',
  'ctl.titulo': 'CONTROLS', 'ctl.mover': 'Move', 'ctl.flechas': 'Arrows', 'ctl.dash': 'Turbo dash', 'ctl.espacio': 'SPACE',
  'ctl.cola': 'Cross your own tail', 'ctl.colaD': 'Jumps over it, costs energy',
  'ctl.sinEnergia': 'Out of energy', 'ctl.sinEnergiaD': 'Your tail burns at full speed — faster the longer it ever got, and that speed never drops. When it runs out, you die. From ×3, no margin at all.',
  'ctl.apuesta': 'THE BET', 'ctl.racha': 'Streak', 'ctl.rachaD': 'Chain fruits and the multiplier climbs. Wait too long and it breaks.',
  'ctl.bote': 'Pot', 'ctl.boteD': 'What streak and leverage bring in. Lost on death.',
  'ctl.cobrarD': 'Cash the pot as is (×1).',
  'ctl.apalancD': 'Leverage ×1 to ×5: multiplies the pot, the drain and the jump cost, and adds a bit of speed. From ×3, no energy = liquidated. Lowering burns 25% of the pot.',
  'ctl.fichasD': 'Three golden fruits = one spin. Pair: 9 s boost. Triple: boost and pot ×3.',
  'ctl.sonidoD': 'Mute / unmute sound.', 'ctl.idiomaD': 'Switch language.',
  'slot.titulo': 'SLOT MACHINE', 'slot.sub': 'Pair: a 9 s boost. Triple: the boost and the pot ×3.',
  'slot.triple': 'TRIPLE!! {nombre} {s}s · POT ×3 CASHED: +{pago}', 'slot.pareja': 'PAIR: {nombre} {s}s — {desc}',
  'slot.nada': 'ALMOST… CONSOLATION: +{n} ENERGY', 'slot.consuelo': 'CONSOLATION +{n}', 'slot.tripleFloat': 'TRIPLE · POT ×3 CASHED',
  'sel.titulo': 'CHOOSE YOUR HIGHER MECHANIC', 'sel.sub': 'One rule for the whole run.', 'sel.clasica': 'Classic', 'sel.clasicaD': 'No extra rules.',
  'sel.bote': '{n} · Pot x{m}', 'sel.rebobinar': 'REROLL', 'sel.elegida': '{nombre} · POT x{m}',
  'fin.titulo': 'RUN OVER', 'fin.puntos': 'POINTS', 'fin.rango': 'Rank reached: {r}', 'fin.colaMax': 'Max tail', 'fin.casillas': '{n} tiles',
  'fin.frutas': 'Fruits', 'fin.saltos': 'Tail jumps', 'fin.tiradas': 'Spins', 'fin.tiradasV': '{t} ({x} triples)', 'fin.rachaMax': 'Max streak',
  'fin.tiempo': 'Time', 'fin.otra': 'RUN AGAIN!', 'fin.menu': 'MENU',
  'fin.boteRescatado': 'Diamond Hands rescued {r} of the {b} in the pot ({p}%).', 'fin.botePerdido': '{b} points sitting in the pot were lost uncashed.',
  'rango.0': 'Neon Viper', 'rango.20': 'Plasma Cobra', 'rango.35': 'Hyperkinetic Python', 'rango.55': 'Alpha Leviathan', 'rango.80': 'Cosmic Ouroboros (Legendary)',
  'pie.mover': 'Move', 'pie.flechas': 'Arrows', 'pie.turbo': 'Turbo', 'pie.espacio': 'SPACE', 'pie.apalancar': 'Leverage', 'pie.cobrar': 'Cash pot',
  'pie.cruzar': 'Crossing your tail costs energy', 'pie.record': 'Best: {pts} pts · tail {cola}', 'pie.sonido': 'Sound (M)',
  'muerte.liquidado': 'LIQUIDATED AT x{n}!', 'muerte.muro': 'INTO THE WALL!', 'muerte.cola': 'TAIL TOUCHED!',
  'muerte.salto': 'CRASH: NOT ENOUGH ENERGY TO JUMP!', 'muerte.inanicion': 'STARVED: TAIL BURNED OUT!',
  'f.sinEnergia': 'OUT OF ENERGY! TAIL BURNING', 'f.come': 'EAT!', 'f.colaN': 'TAIL {n}', 'f.aTiempo': 'IN TIME', 'f.aTiempoCola': 'IN TIME · -{n} TAIL',
  'f.muroAviso': 'THE OPEN WALL IS ABOUT TO MOVE…', 'f.muroLibre': 'OPEN WALL: {m}',
  'muro.0': 'TOP', 'muro.1': 'RIGHT', 'muro.2': 'BOTTOM', 'muro.3': 'LEFT',
  'f.frutaPerdidaRacha': 'FRUIT LOST: STREAK BROKEN (x{m})', 'f.frutaPerdida': 'FRUIT LOST', 'f.finBuff': 'OVER: {n}',
  'f.saltoGratis': 'FREE PHASE JUMP!', 'f.rebote': 'ELASTIC BOUNCE! +{n}', 'f.salto': '-{n} (JUMP!)', 'f.segundaVida': 'SECOND LIFE!',
  'f.absorcion': 'MAGNETIC PULL!', 'f.ficha': 'TOKEN {a}/{b} · +{e} ENERGY (+{x} XP)', 'f.cristal': 'PHASE CRYSTAL: 2 JUMPS! (+{x} XP)',
  'f.hiper': 'HYPER-NUTRITION! +{e} (+{x} XP)', 'f.normal': '+{e} (+{g} TAIL) [+{x} XP]', 'f.alBote': '+{n} TO POT', 'f.rachaPerdida': 'STREAK LOST (x{m})',
  'f.apalancamiento': 'LEVERAGE x{n}{aviso}', 'f.liquidadoAviso': ' · NO ENERGY = LIQUIDATED', 'f.cerrarPosicion': 'CLOSING POSITION: -{n} FROM POT',
  'f.todoApalancado': 'ALL-IN LEVERAGE: CAN’T GO BELOW x{n}', 'f.cobrado': 'CASHED', 'f.volatil': 'VOLATILE POT: ONLY THE JACKPOT PAYS',
  'f.buff': '{n} · {s}s', 'f.frenesi': 'FRENZY!!', 'f.frenesiSub': 'HALF DRAIN · +30% SPEED · POT x2', 'f.frenesiFinResaca': 'FRENZY OVER · NO HANGOVER',
  'f.bajon': 'CRASH: DRAIN x{g} FOR {s}s', 'f.mutacion': 'MUTATION ASSIMILATED!', 'f.degen': 'DEGEN MODE! LEVERAGE x{n} ON KEY 5',
  'f.sinResaca': 'NO HANGOVER!', 'f.bateria': 'BATTERY LEVEL {n}! (MAX: {m})', 'f.frutas': 'MULTI-FRUIT LEVEL {n}! (Total: {t} fruits)',
  'f.fantasma': 'PHANTOM JUMPS +3! (TOTAL: {n})', 'f.hito': 'STREAK {n}',
  'f.portal': 'PORTAL!', 'f.impulso': 'BOOST! {s}s NO DRAIN', 'f.barrido': 'SWEEP! +{n} FRUITS', 'f.artefactoEuforia': 'EUPHORIA!',
  'ctl.artefactos': 'Artifacts', 'ctl.artefactosD': 'Appear on the arena for 15 s: portal (A ↔ B), boost (5 s of speed with no drain), sweep (pulls every fruit and doubles them) and euphoria (instant frenzy).',

  // catálogos (en español viven en app.mjs)
  'perk.cryo_metabolism.name': 'Cryo Metabolism', 'perk.cryo_metabolism.desc': 'Cuts length drain with diminishing returns (-34% at level 1, down to 17% per level).', 'perk.cryo_metabolism.badge': 'Passive',
  'perk.phantom_vault.name': 'Phantom Jump', 'perk.phantom_vault.desc': 'Tail jump costs only 4 energy and grants +3 free quantum jumps per level.', 'perk.phantom_vault.badge': 'Mobility',
  'perk.quantum_magnet.name': 'Quantum Magnet', 'perk.quantum_magnet.desc': 'Pulls fruits from 2 tiles; +1 tile per level, up to 7.', 'perk.quantum_magnet.badge': 'Utility',
  'perk.twin_fruits.name': 'Multi-Fruit', 'perk.twin_fruits.desc': 'Keeps 3 fruits on the arena (+2 per extra level), dense hunting grounds.', 'perk.twin_fruits.badge': 'Arena',
  'perk.turbo_efficient.name': 'Overcharged Dash', 'perk.turbo_efficient.desc': 'Turbo uses 80% less energy and adds +25% speed.', 'perk.turbo_efficient.badge': 'Turbo',
  'perk.battery_upgrade.name': 'Nuclear Battery', 'perk.battery_upgrade.desc': 'Max energy +50 (stacks) and fruits restore +18 extra energy per level.', 'perk.battery_upgrade.badge': 'Energy',
  'perk.hyperspace_compass.name': 'Hyperspace Sensor', 'perk.hyperspace_compass.desc': 'Holographic guide with +35% speed toward fruit and 40% less metabolic drain.', 'perk.hyperspace_compass.badge': 'Navigation',
  'perk.elastic_body.name': 'Elastic Body', 'perk.elastic_body.desc': 'Guaranteed +15 energy back on every tail jump.', 'perk.elastic_body.badge': 'Survival',
  'perk.dense_nutrition.name': 'Dense Nutrition', 'perk.dense_nutrition.desc': 'Double XP from all fruits, +12 energy per level, and every fruit grows the tail one extra segment per level.', 'perk.dense_nutrition.badge': 'Growth',
  'perk.cosmic_resonance.name': 'Ouroboros Resonance', 'perk.cosmic_resonance.desc': 'Every 10 tail tiles: +12% speed and 17% less length drain.', 'perk.cosmic_resonance.badge': 'Legendary',
  'perk.manos_diamante.name': 'Diamond Hands', 'perk.manos_diamante.desc': 'On death the pot is not lost: cashed at 50% (+25% per level, up to 100%).', 'perk.manos_diamante.badge': 'Bet',
  'perk.martingala.name': 'Martingale', 'perk.martingala.desc': 'After a spin with no pair, the next one guarantees a pair.', 'perk.martingala.badge': 'Bet',
  'perk.sin_resaca.name': 'No Hangover', 'perk.sin_resaca.desc': 'Removes the crash after frenzy. Each extra level adds +2 s of frenzy.', 'perk.sin_resaca.badge': 'Frenzy',
  'perk.degen.name': 'Degen Mode', 'perk.degen.desc': 'Unlocks x10 leverage: the pot fills x10, base drain x4.15, and every tail jump costs 100 energy.', 'perk.degen.badge': 'Legendary',
  'mec.muro_errante.name': 'Wandering Wall', 'mec.muro_errante.desc': 'Three walls kill. The open one moves around.',
  'mec.cola.name': 'Untouchable Tail', 'mec.cola.desc': 'Touching your tail ends the run.',
  'mec.fugaces.name': 'Fleeting Fruits', 'mec.fugaces.desc': 'Fruits expire after 7 s.',
  'mec.turbo_gratis.name': 'Free Turbo', 'mec.turbo_gratis.desc': 'Dashing costs no energy.',
  'mec.metabolismo_lento.name': 'Slow Metabolism', 'mec.metabolismo_lento.desc': 'You burn 40% less energy.',
  'mec.segunda_vida.name': 'Second Life', 'mec.segunda_vida.desc': 'Your first death is forgiven.',
  'mec.salto_caro.name': 'Costly Jump', 'mec.salto_caro.desc': 'Jumping your tail costs double.',
  'mec.metabolismo.name': 'Double Metabolism', 'mec.metabolismo.desc': 'You burn twice the energy.',
  'mec.volatil.name': 'Volatile Pot', 'mec.volatil.desc': 'No cashing out. Only the jackpot pays.',
  'mec.muros.name': 'Steel Walls', 'mec.muros.desc': 'The edges no longer wrap: touching a wall is death.',
  'mec.velocidad.name': 'Triple Speed', 'mec.velocidad.desc': 'The snake moves at triple base speed.',
  'mec.apalancada.name': 'All-In Leverage', 'mec.apalancada.desc': 'You start at ×5 and cannot go lower.',
  'sym.escudo.name': 'INVINCIBLE', 'sym.escudo.desc': 'nothing kills you and your tail is free to cross',
  'sym.energia.name': 'NO DRAIN', 'sym.energia.desc': 'energy does not drop',
  'sym.iman.name': 'TOTAL MAGNET', 'sym.iman.desc': 'you pull every fruit on the arena',
  'sym.bote.name': 'DOUBLE POT', 'sym.bote.desc': 'everything entering the pot ×2',
  'sym.lento.name': 'SLOW MOTION', 'sym.lento.desc': 'half speed, half drain'
};

const TEXTOS = { es: ES, en: EN };
