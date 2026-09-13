// os-shim.mjs — el anfitrión mínimo que la app espera: una "ventana" y un
// contexto. El juego nació como app de ventana dentro de un escritorio
// simulado y conserva ese contrato:
//   ctx = { win, root, os, t, machine, session, args, context }
//   win = { id, setTitle, setIcon, close, focus, dialog, onClose }
//   mount(ctx) obligatorio; unmount/activate/freeze/thaw opcionales.
//
// Snake Cogue Pite sólo consume `root`, `win.setTitle` y `t(clave)`. El resto se
// implementa igual para que el contrato quede completo.

const TOKENS_OSCUROS = {
  // Tema oscuro de la app. Se antepone Saira
  // porque Segoe UI sólo existe en Windows: fuera del juego, el HUD caía en una
  // fuente distinta en cada máquina.
  '--font': '"Saira", "Segoe UI", "Segoe UI Variable Text", system-ui, sans-serif',
  '--win-bg': '#202020',
  '--win-fg': '#FFFFFF',
  '--win-muted': '#A0A0A0',
  '--win-border': '#5A5A5A',
  '--accent': '#00E5FF'
};

export function aplicarTokens(el = document.documentElement) {
  for (const [k, v] of Object.entries(TOKENS_OSCUROS)) el.style.setProperty(k, v);
}

// Diccionario del anfitrión: sólo las claves que la app pide.
const DICCIONARIO = {
  TITULO_APP: 'Snake Cogue Pite'
};

export function crearT(extra = {}) {
  const tabla = { ...DICCIONARIO, ...extra };
  return function t(clave, ...fmt) {
    const base = Object.prototype.hasOwnProperty.call(tabla, clave) ? tabla[clave] : clave;
    return fmt.length ? fmt.reduce((s, v, i) => s.split(`{${i}}`).join(String(v)), base) : base;
  };
}

// `win`: el handle de la ventana. Aquí una sola ventana
// ocupa la página entera, así que focus/close/dialog son degradaciones honestas.
export function crearWin({ id = 1, onTitulo, onIcono, onCerrar } = {}) {
  const alCerrar = [];
  return {
    id,
    setTitle: (texto) => { if (onTitulo) onTitulo(String(texto)); },
    setIcon: (url) => { if (onIcono) onIcono(url); },
    close: () => {
      for (const fn of alCerrar) { try { fn(); } catch (e) { console.error('onClose', e); } }
      if (onCerrar) onCerrar();
    },
    focus: () => { /* ventana única: siempre enfocada */ },
    dialog: async (opts) => {
      // Sin escritorio anfitrión no hay diálogos modales propios.
      console.warn('[os-shim] win.dialog() sin anfitrión:', opts);
      return true;
    },
    onClose: (fn) => { if (typeof fn === 'function') alCerrar.push(fn); }
  };
}

// `os`: capacidades del anfitrión. Snake no lo toca; se deja la
// forma con capacidades en false para que cualquier app que sí lo use falle
// de forma limpia y visible en vez de silenciosa.
export function crearOs(appId) {
  const noDisponible = (que) => () => {
    throw new Error(`[os-shim] la capacidad "${que}" no existe en esta página`);
  };
  return {
    appId,
    caps: { sys: false, settings: false, notify: false, fs: false, usb: false, wallet: false, shop: false },
    notify: (msg) => console.info(`[os-shim] notify: ${msg}`),
    fs: null,
    wallet: noDisponible('wallet'),
    shop: noDisponible('shop'),
    settings: noDisponible('settings')
  };
}

export function crearCtx({ appId, root, win, t }) {
  return {
    win,
    root,
    os: crearOs(appId),
    t,
    machine: { id: 'standalone', os_name: 'web', context: {} },
    session: { user: 'jugador' },
    args: {},
    context: {}
  };
}
