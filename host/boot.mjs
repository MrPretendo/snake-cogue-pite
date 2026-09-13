// boot.mjs — arranque de Snake Cogue Pite en una página web.
// Construye una "ventana" que ocupa la página, arma el ctx con el shim, escala
// el escenario a la resolucion logica del juego y monta la app.

import { aplicarTokens, crearT, crearWin, crearCtx } from './os-shim.mjs';
import * as app from '../src/app.mjs';
import { RESOLUCION } from '../src/app.mjs';

const ID_APP = 'snake_cogue_pite';

export async function arrancar(contenedor = document.body) {
  aplicarTokens();

  contenedor.insertAdjacentHTML('beforeend', [
    '<div class="sh-win" data-focus="1">',
    '  <div class="sh-title">',
    '    <img class="sh-title__icon" src="src/icon.svg" alt="">',
    '    <span class="sh-title__text">Snake Cogue Pite</span>',
    '    <span class="sh-title__badge">holo · arcade</span>',
    '  </div>',
    '  <div class="sh-body"><div class="sh-stage"></div></div>',
    '</div>'
  ].join(''));

  // El juego se mide siempre a su resolucion logica; el escenario se escala
  // (letterbox centrado) para encajar en el hueco, sea el que sea.
  const cuerpo = contenedor.querySelector('.sh-body');
  const root = contenedor.querySelector('.sh-stage');
  root.style.width = RESOLUCION.ancho + 'px';
  root.style.height = RESOLUCION.alto + 'px';
  const ajustarEscala = () => {
    const r = cuerpo.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const k = Math.min(r.width / RESOLUCION.ancho, r.height / RESOLUCION.alto);
    const dx = (r.width - RESOLUCION.ancho * k) / 2;
    const dy = (r.height - RESOLUCION.alto * k) / 2;
    root.style.transform = `translate(${dx}px, ${dy}px) scale(${k})`;
  };
  new ResizeObserver(ajustarEscala).observe(cuerpo);
  ajustarEscala();
  const textoTitulo = contenedor.querySelector('.sh-title__text');

  const win = crearWin({
    id: 1,
    onTitulo: (texto) => { textoTitulo.textContent = texto; document.title = texto; },
    onIcono: (url) => { contenedor.querySelector('.sh-title__icon').src = url; },
    onCerrar: () => { try { app.unmount?.(); } catch (e) { console.error(e); } }
  });

  const ctx = crearCtx({ appId: ID_APP, root, win, t: crearT() });
  await app.mount(ctx);

  // El anfitrión congela la app cuando no se ve, para que no deje
  // temporizadores corriendo: en una página, la pestaña en segundo plano.
  document.addEventListener('visibilitychange', () => {
    try {
      if (document.hidden) app.freeze?.();
      else app.thaw?.();
    } catch (e) { console.error('freeze/thaw', e); }
  });

  window.addEventListener('pagehide', () => { try { app.freeze?.(); } catch (e) { /* saliendo */ } });

  return { app, ctx };
}

if (!window.__SNAKE_SIN_AUTOARRANQUE) {
  arrancar().catch((e) => {
    console.error('[boot] fallo al montar', e);
    document.body.insertAdjacentHTML('beforeend',
      `<pre style="color:#FF5252;font:13px monospace;padding:16px">No se pudo montar la app:\n${e && e.stack ? e.stack : e}</pre>`);
  });
}
