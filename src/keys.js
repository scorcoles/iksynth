// =========================================================================================
// Tocar: el teclado del ordenador y el de la pantalla
// =========================================================================================
//
// En el ordenador, como en casi todos los sintes de navegador: la fila de la A son las
// teclas blancas (A = do) y la de encima, las negras (W = do#, E = re#, T, Y, U, O, P).
// Z y X bajan y suben una octava. Se usa el sitio de la tecla, no la letra: en un teclado
// español, la que va después de la L es la Ñ.
//
// En la pantalla, las mismas teclas dibujadas: se tocan con el dedo o el ratón, y
// arrastrando se pasa de una a otra. Lo que suena desde cualquiera de los dos se ilumina
// aquí.
//
// Qué suena lo decide main.js (la pista elegida): aquí solo se dice qué nota (en número
// MIDI) empieza y cuál acaba. Con la caja de ritmos, cada tecla blanca es un instrumento
// (A = kick, S = snare…) y su nombre se ve en la tecla.

// Las teclas del ordenador, por su sitio (KeyboardEvent.code), y cuántos semitonos por
// encima del do de la octava suena cada una.
const CODES = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9,
  KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16,
};
const BLACK = new Set([1, 3, 6, 8, 10, 13, 15]);
const OCTAVE_MIN = 1;
const OCTAVE_MAX = 7;

// La letra que se ve en cada tecla: la del teclado de quien toca, si el navegador la sabe
// (Chrome); si no, la de un teclado español.
const FALLBACK = { Semicolon: 'Ñ' };
const labelOf = (code, layout) => (layout?.get(code) || FALLBACK[code] || code.replace('Key', '')).toUpperCase();

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (midi) => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

// root: donde va el teclado de la pantalla. target: noteOn(midi), noteOff(midi) y
// releaseAll().
export function setupKeys(root, target) {
  let octave = 4;
  // Las notas pulsadas ahora (en número MIDI).
  const held = new Set();
  const base = () => (octave + 1) * 12; // el do de la octava, en número MIDI

  // ---- El teclado de la pantalla ----
  const octaveBox = document.createElement('div');
  octaveBox.className = 'keys__octave';
  octaveBox.innerHTML =
    '<button type="button" data-oct="-1" aria-label="Bajar una octava">−</button>' +
    '<span data-oct-label></span>' +
    '<button type="button" data-oct="1" aria-label="Subir una octava">+</button>';
  const octaveLabel = octaveBox.querySelector('[data-oct-label]');
  const board = document.createElement('div');
  board.className = 'keys__board';
  root.append(octaveBox, board);

  // Las blancas, en fila; las negras, encima, a caballo entre dos.
  const keyEls = [];
  const offsets = Object.values(CODES);
  const whites = offsets.filter((o) => !BLACK.has(o)).length;
  let w = 0;
  for (const [code, offset] of Object.entries(CODES)) {
    const k = document.createElement('div');
    const black = BLACK.has(offset);
    k.className = black ? 'key key--black' : 'key';
    k.dataset.offset = offset;
    k.dataset.code = code;
    if (black) k.style.left = `${(w / whites) * 100}%`;
    else w++;
    k.innerHTML = '<span class="key__name"></span><span class="key__label"></span>';
    keyEls.push(k);
  }
  // Primero las blancas y luego las negras: así las negras quedan encima.
  board.style.setProperty('--whites', whites);
  keyEls.filter((k) => !k.classList.contains('key--black')).forEach((k) => board.append(k));
  keyEls.filter((k) => k.classList.contains('key--black')).forEach((k) => board.append(k));

  const paint = () => {
    octaveLabel.textContent = `oct ${octave}`;
    for (const k of keyEls) k.classList.toggle('is-down', held.has(base() + Number(k.dataset.offset)));
  };
  const setLabels = (layout) => keyEls.forEach((k) => (k.querySelector('.key__label').textContent = labelOf(k.dataset.code, layout)));
  setLabels(null);
  navigator.keyboard?.getLayoutMap?.().then(setLabels).catch(() => {});

  const play = (midi) => {
    if (held.has(midi)) return;
    held.add(midi);
    target.noteOn(midi);
    paint();
  };
  const stop = (midi) => {
    if (!held.delete(midi)) return;
    target.noteOff(midi);
    paint();
  };

  const shift = (by) => {
    octave = Math.max(OCTAVE_MIN, Math.min(OCTAVE_MAX, octave + by));
    paint();
  };
  octaveBox.addEventListener('click', (e) => {
    const b = e.target.closest('[data-oct]');
    if (b) shift(Number(b.dataset.oct));
  });

  // Con el dedo o el ratón: cada puntero lleva su nota; al arrastrar, cambia de tecla.
  const pointers = new Map();
  const keyAt = (e) => {
    const t = document.elementFromPoint(e.clientX, e.clientY)?.closest('.key');
    return t && board.contains(t) ? base() + Number(t.dataset.offset) : null;
  };
  const move = (e) => {
    if (!pointers.has(e.pointerId)) return;
    const was = pointers.get(e.pointerId);
    const now = keyAt(e);
    if (now === was) return;
    if (was != null) stop(was);
    if (now != null) play(now);
    pointers.set(e.pointerId, now);
  };
  board.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    board.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, null);
    move(e);
  });
  board.addEventListener('pointermove', move);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    board.addEventListener(type, (e) => {
      const was = pointers.get(e.pointerId);
      if (was != null) stop(was);
      pointers.delete(e.pointerId);
    });
  }

  // ---- El teclado del ordenador ----
  // Cada tecla recuerda qué nota empezó: si se cambia de octava con ella pulsada, se
  // suelta la que sonaba.
  const down = new Map();
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select') && !(e.code in CODES)) return;
    if (e.code === 'KeyZ' || e.code === 'KeyX') {
      if (!e.repeat) shift(e.code === 'KeyZ' ? -1 : 1);
      e.preventDefault();
      return;
    }
    if (!(e.code in CODES)) return;
    e.preventDefault();
    if (e.repeat || down.has(e.code)) return;
    const midi = base() + CODES[e.code];
    down.set(e.code, midi);
    play(midi);
  });
  window.addEventListener('keyup', (e) => {
    if (!down.has(e.code)) return;
    stop(down.get(e.code));
    down.delete(e.code);
  });
  // Si la ventana pierde el foco con teclas pulsadas, no llegarían sus «keyup»: todo fuera.
  window.addEventListener('blur', () => {
    releaseAll();
  });
  function releaseAll() {
    down.clear();
    pointers.clear();
    held.clear();
    target.releaseAll();
    paint();
  }

  paint();
  return {
    // Al cambiar de pista: suelta todo (lo que sonaba era de la otra).
    releaseAll,
    // Nombres en las teclas blancas (los instrumentos de la caja), o null para quitarlos.
    setNames(names) {
      root.classList.toggle('has-names', !!names);
      const whitesEls = keyEls.filter((k) => !k.classList.contains('key--black'));
      whitesEls.forEach((k, i) => (k.querySelector('.key__name').textContent = names?.[i] ?? ''));
    },
    // El do de la octava (número MIDI), para traducir notas a instrumentos.
    base,
  };
}
