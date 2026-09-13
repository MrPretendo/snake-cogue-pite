# Snake Cogue Pite

Un snake roguelite de apuesta con estética holográfica. Puramente web: HTML,
CSS, JavaScript y Canvas 2D, sin dependencias ni build. Español e inglés.

**Jugar:** <https://claude.ai/code/artifact/570049cd-8950-4f1c-bafc-f7ad1c1523c8>

Es un minijuego vibecodeado como extra de un proyecto mayor; se publica porque
resultó divertido. Si quieres modificarlo, extraerlo, reempaquetarlo o
continuarlo, adelante — sólo se pide la auditoría apropiada. Autor:
[MrPretendo](https://www.patreon.com/c/MrPretendo).

## Correrlo en local

```bash
node tools/serve.js
```

Y abrir <http://127.0.0.1:8080/>. Hace falta un servidor: los módulos ES no
cargan sobre `file://`.

## Estructura

```
src/        el juego: app.mjs (lógica y render), app.css, fx.mjs (efectos),
            sonido.mjs (efectos sintetizados), musica.mjs (soundtrack),
            idioma.mjs (ES/EN), iconos.mjs (sprite vectorial), musica/ (mp3)
host/       el marco de la página: boot.mjs, os-shim.mjs, shell.css
artifact/   la piel de la página publicada
tools/      servidor de desarrollo y build del paquete publicable
```

El juego se escribe contra un contrato de anfitrión mínimo (`mount(ctx)`,
`unmount`, `freeze`, `thaw`; `ctx = { win, root, os, t, ... }`) que
`host/os-shim.mjs` implementa. Declara una resolución lógica fija
(`RESOLUCION = 800×600`) y el anfitrión la escala para encajar en el hueco.

## Cómo se juega

Arranca en un menú (Jugar, Controles, Acerca de, idioma ES·EN; Enter juega,
Escape vuelve, **L** cambia el idioma, **M** silencia). Mover con **WASD** o
**flechas**; **Espacio** o **Shift** para el dash. La energía baja sola y más
rápido cuanto más larga la cola; las frutas la reponen. Puedes **cruzar tu
propia cola** gastando energía. Al subir de nivel eliges una de tres cartas de
mutación, y se acumulan.

El gasto tiene un **piso proporcional a la cola** que ninguna carta rebaja
(`1 + 0.025·cola` por segundo: cola 100 → 3.5, cola 500 → 13.5); las cartas
sólo pueden bajar la fórmula hasta ahí, y Resonancia mitiga como mucho 5
tramos. Apalancamiento, bajón y la mecánica de la run multiplican después.

**Sin energía, la cola se quema**: tras 0.75 s de aviso arde a `colaMáxima ÷ 3`
segmentos por segundo (mínimo 2/s), y esa velocidad no baja nunca — una cola
recuperada arde igual de rápido. Al quedar sin cola, mueres.

### Mecánicas superiores

Antes de cada run se ofrecen tres cartas: **Clásica** en el centro y, a los
lados, dos cartas dobles que combinan mecánicas de categorías distintas
(atención, beneficio, nerf) sorteadas al azar; el bote de una carta doble es el
producto. **Rebobinar** (R) vuelve a sortear.

| Mecánica | Regla | Bote |
|---|---|---|
| Muro Errante | Tres muros matan; el cuarto envuelve y salta de sitio cada 6 s | ×2 |
| Cola Intocable | Tocar tu cola es el fin | ×2 |
| Frutas Fugaces | Las frutas caducan a los 7 s y rompen la racha | ×1.5 |
| Turbo Gratis | El dash no gasta energía | ×0.8 |
| Metabolismo Lento | Gastas un 40 % menos | ×0.8 |
| Segunda Vida | La primera muerte se perdona | ×0.75 |
| Salto Caro | Cruzar la cola cuesta el doble | ×1.5 |
| Metabolismo Doble | Gastas el doble | ×1.75 |
| Bote Volátil | No se puede cobrar: sólo paga el jackpot | ×2 |

### La apuesta

- **Racha**: cada fruta dentro de la ventana (3.5 s, se estrecha hasta 1.5 s)
  sube el multiplicador `1 + 0.25·racha`, tope ×4. Cada 5 de racha, hito.
- **Puntos y bote**: la fruta paga su valor en puntos seguros y mete
  `valor × racha × apalancamiento` en el **bote**, que está en juego. Se cobra
  con **C** (×1), lo triplica un triple en la tragaperras, o se pierde al morir.
- **Fichas y tragaperras**: la fruta dorada es una ficha; con tres, salta una
  tragaperras. Pareja: una mejora de 9 s (invencible, sin gasto, imán total,
  bote doble, cámara lenta). Triple: la mejora y el bote ×3. Nada: +40 energía.
- **Apalancamiento** (**1–5**, **Q/E**): ×1 a ×5 (×10 con la carta Degen).
  Multiplica el bote, el gasto y el coste del salto, y da +4 % de velocidad por
  nivel. Desde ×3, sin energía = liquidado. Bajar quema el 25 % del bote.
- **Frenesí**: las frutas llenan un medidor; al tope, 8 s con medio gasto,
  +30 % de velocidad, bote ×2 y lluvia de frutas; después, bajón de 4 s.

Todas las cifras son constantes al principio de `src/app.mjs`.

## Ranking

Tabla de puntuaciones en Supabase (plan gratuito) vía su API REST
(`src/ranking.mjs`). Al morir, el resumen pide un nombre (12 caracteres, sin
cuenta) y lo envía; el menú tiene un panel **Ranking** con el top 10. La clave
que va en el código es la *publishable*, pública por diseño: lo que puede
hacer un visitante lo fijan las reglas de la tabla — `tools/ranking.sql`,
pegar en el SQL Editor de Supabase — (insertar una fila válida y leer; nada de
editar ni borrar; topes por CHECK). Sin conexión, o donde el anfitrión bloquee
`fetch` (el visor de artifacts de claude.ai lo hace), el juego lo dice y sigue.
Un ranking anónimo desde JS es trucable por definición: aquí se mitiga, no se
elimina.

## Publicar el paquete

```bash
tools/build-artifact.sh <directorio>
```

Copia la página (`artifact/page.html` → `index.html`) y sus archivos de apoyo
en sus rutas relativas. No hay bundler: `src/` llega tal cual.

## Licencia y créditos

Código bajo licencia **MIT** (ver `LICENSE`): úsalo, modifícalo y redistribúyelo
con atribución.

- **Música**: *Snake Cogue Pite*, compuesta por MrPretendo con
  [Strudel](https://strudel.cc). Si la reutilizas, acredita al autor.
- **Iconos**: [Lucide](https://lucide.dev), licencia ISC, © Lucide Icons and Contributors.
- Todo lo demás: MrPretendo.
