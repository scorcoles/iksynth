// =========================================================================================
// iksynth: un sintetizador en el navegador, con su sonido dibujado en tiempo real
// =========================================================================================
//
// Un experimento de VERTIK. Pistas: «synth» (el sinte; hasta cuatro, con «+»), «acid» (un
// bajo ácido, con accent y slide) y «drums» (una caja de ritmos), cada una con su
// secuencia de 16 pasos.
// Se toca la pista elegida con el teclado del ordenador o con el de la pantalla, y lo que
// se toca se puede grabar en su secuencia; el panel de la derecha cambia su sonido. Todo
// lo que suena se dibuja mientras suena.
//
//   audio.js     → el bus de salida: la mezcla, el silencio, el foco y los analizadores
//   synth.js     → el sinte: las voces, el LFO y los efectos
//   acid.js      → el bajo ácido
//   drums.js     → la caja de ritmos
//   sequencer.js → los 16 pasos, el transporte y la grabación
//   seqview.js   → lo que se ve del secuenciador
//   visual.js    → lo que se ve: la esfera de puntos y su malla
//   panel.js     → el panel con el sonido de cada pista
//   keys.js      → tocar: el teclado del ordenador y el de la pantalla
//   demos.js     → las demos (#demo1, #demo2…)
//   song.js      → la canción en la URL
//   share.js     → compartir la canción, con un enlace
//   main.js      → el escenario, la cámara, los modos, las pistas y el bucle (este archivo)
//
// Tres modos, con «Prev» y «Next» en el pie, las flechas del teclado o la dirección
// (#wire, #unit): «orb», una esfera de puntos que respira con el sonido, azul hielo sobre
// negro azulado; «wire», la misma esfera en malla gris sobre papel; y «unit», todo como un
// aparato de aluminio: la esfera en una pantallita negra, teclas de verdad y ruedas de
// colores.

import * as THREE from 'three';
import { createBus } from './audio.js';
import { createSynth, DEFAULTS as SYNTH_DEFAULTS } from './synth.js';
import { createAcid, ACID_DEFAULTS } from './acid.js';
import { createDrums, VOICES, DRUM_DEFAULTS } from './drums.js';
import { DEMOS, EMPTY } from './demos.js';
import { createSequencer, synthTrack, synthIndex, kindOf } from './sequencer.js';
import { createSeqView } from './seqview.js';
import { createVisual, toBands, BANDS } from './visual.js';
import { createPanel } from './panel.js';
import { setupKeys } from './keys.js';
import { setupShare } from './share.js';
import { encodeSong, readSong, clearSongFromUrl, songUrl } from './song.js';
import '../style.css';

// Los modos: el color de la página y el de la tinta, y desde dónde mira la cámara (su
// sitio y adónde mira, para una pantalla apaisada; en vertical, se aleja).
const LOOKS = {
  orb: { page: '#070a12', ink: '#a9c9ff', eye: [0, 0, 4.8], target: [0, -0.22, 0], fog: [4.2, 6.2] },
  wire: { page: '#eeeeee', ink: '#333333', eye: [0, 0, 4.8], target: [0, -0.22, 0], fog: [4.2, 6.4] },
  // En unit, «page» es el negro de su pantallita; el aluminio del aparato lo pone style.css.
  unit: { page: '#0b0b0b', ink: '#f0f0f0', eye: [0, 0, 4.6], target: [0, 0, 0], fog: [4.0, 6.0] },
};

// Cuánto se mueve la cámara con el cursor (o con el dedo), como si se mirara de lado.
const PARALLAX = 0.35;

const canvas = document.querySelector('[data-iksynth]');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
const visual = createVisual(scene);

// En vertical, la cámara se aleja para que quepa lo ancho.
let away = 1;
function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  away = Math.max(1, 1.25 / camera.aspect);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);
resize();

const MODES = Object.keys(LOOKS);
let mode = MODES[0];
function setMode(name) {
  mode = MODES.includes(name) ? name : MODES[0];
  const { page, ink } = LOOKS[mode];
  renderer.setClearColor(page);
  visual.setLook(mode, page, ink, renderer.getPixelRatio());
  // El modo, en <html>: style.css cambia los colores de la página.
  document.documentElement.dataset.mode = mode;
  const hash = mode === MODES[0] ? '' : `#${mode}`;
  if (location.hash !== hash) history.replaceState(null, '', location.pathname + location.search + hash);
}
const stepMode = (by) => setMode(MODES[(MODES.indexOf(mode) + by + MODES.length) % MODES.length]);
document.querySelector('[data-mode-prev]')?.addEventListener('click', () => stepMode(-1));
document.querySelector('[data-mode-next]')?.addEventListener('click', () => stepMode(1));
window.addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  // En un deslizador del panel, las flechas lo mueven a él.
  if (e.target.closest?.('input')) return;
  e.preventDefault();
  stepMode(e.key === 'ArrowLeft' ? -1 : 1);
});
// #demo1, #demo2…: una demo (demos.js). Se carga (al abrir, cuando todo está listo) y la
// dirección se queda con el modo, sin la demo.
let ready = false;
let startDemo = -1;
const fromHash = () => {
  const hash = decodeURIComponent(location.hash.slice(1));
  const demo = hash.match(/^demo(\d+)$/);
  if (!demo) return setMode(hash);
  const i = Number(demo[1]) - 1;
  setMode(mode);
  if (ready) loadDemo(i);
  else startDemo = i;
};
window.addEventListener('hashchange', fromHash);
fromHash();

// El sonido: el bus y las pistas (los sintes se crean más abajo, uno por pista de synth).
const bus = createBus();
const engines = {
  synths: [],
  acid: createAcid(bus.input),
  drums: createDrums(bus.input),
};

// Lo que hay guardado en este navegador (los sonidos, las secuencias y la pista
// elegida). Puede no haber nada, o no poder leerse: entonces, lo de serie. Si se llega
// con una canción en el enlace (?song=…), manda la del enlace.
const STORE = 'iksynth:v1';
let saved = null;
try {
  saved = JSON.parse(localStorage.getItem(STORE) || 'null');
} catch {
  saved = null;
}
const shared = await readSong();
if (shared) saved = { ...shared, track: saved?.track };
if (saved?.acid) engines.acid.load(saved.acid);
if (saved?.drums) engines.drums.load(saved.drums);
// El sonido de cada pista de synth (lo guardado antes de que hubiera varias: «synth»).
const savedSynths = Array.isArray(saved?.synths) ? saved.synths : saved?.synth ? [saved.synth] : [];

// El enlace para compartir, siempre al día (share.js).
let shareCode = '';
const song = () => ({
  synths: engines.synths.map((e) => e.params),
  acid: engines.acid.params,
  drums: engines.drums.params,
  seq: seq.state,
});
// La demo cargada (−1: ninguna) y cómo era la canción al cargarla: si ha cambiado, cargar
// otra pide confirmación. Al abrir, lo que hubiera guardado cuenta como cambiado.
let demoIndex = -1;
let snapshot = '';
const songJson = () => JSON.stringify(song());

const refreshShare = () => encodeSong(song()).then((code) => (shareCode = code)).catch(() => {});

let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ ...song(), track }));
    } catch {
      /* sin sitio o sin permiso: no se guarda, sin más */
    }
    refreshShare();
  }, 400);
}

// El altavoz de arriba: apagado de entrada. Como esto es un instrumento, la primera nota
// (o el primer play) lo enciende sola, si no se ha tocado antes el botón; después, manda
// el botón.
const soundButton = document.querySelector('[data-sound]');
let soundOn = false;
let soundTouched = false;
function setSound(on) {
  soundOn = on;
  bus.setMuted(!on);
  if (on) bus.start();
  soundButton?.classList.toggle('is-on', on);
  soundButton?.setAttribute('aria-pressed', String(on));
  soundButton?.setAttribute('aria-label', on ? 'Apagar el sonido' : 'Encender el sonido');
}
soundButton?.addEventListener('click', () => {
  soundTouched = true;
  setSound(!soundOn);
});
const wake = () => {
  bus.start();
  if (!soundTouched && !soundOn) setSound(true);
};

// Para los dibujos: cuándo sonó el último golpe, y si acaba de sonar uno.
let lastHit = 0;
let kicked = false;
const hitNow = () => {
  lastHit = performance.now();
  kicked = true;
};

// El panel: el sonido de la pista elegida. Cada cambio se guarda (y, si era una demo, ya
// no lo es).
const panel = createPanel(document.querySelector('[data-panel]'), () => {
  save();
  view?.refreshDemo();
});
panel.add('acid', 'acid', engines.acid);
panel.add('drums', 'drums', engines.drums);

// El secuenciador.
let track = 'synth:0';
const seq = createSequencer(engines, {
  onChange() {
    view?.render();
    save();
  },
  onStep: (step) => view?.setStep(step),
  onBeat(what) {
    // El kick y las notas empujan la esfera; el resto de la caja, solo un poco.
    if (what === 'drums') lastHit = Math.max(lastHit, performance.now() - 120);
    else hitNow();
  },
});
seq.load(saved?.seq);

// Las pistas de synth: un sinte y un cuerpo del panel por cada una.
function makeSynth(i, params) {
  const engine = createSynth(bus.input);
  if (params) engine.load(params);
  engines.synths[i] = engine;
  panel.add(synthTrack(i), 'synth', engine);
}
seq.state.synths.forEach((_, i) => makeSynth(i, savedSynths[i]));

// Las pistas, en orden (para las pestañas y las teclas 1, 2, 3…), con su nombre.
const synthName = (i) => (i === 0 ? 'synth' : `synth ${i + 1}`);
const trackList = () => [
  ...engines.synths.map((_, i) => ({ id: synthTrack(i), name: synthName(i) })),
  { id: 'acid', name: 'acid' },
  { id: 'drums', name: 'drums' },
];
const nameOf = (t) => trackList().find((x) => x.id === t)?.name ?? t;

// Lo que suena al tocar en directo, de la pista elegida.
const liveEngine = (t) => (kindOf(t) === 'synth' ? engines.synths[synthIndex(t)] : engines[t]);

const view = createSeqView(document.querySelector('[data-seq]'), seq, {
  play() {
    wake();
    seq.toggle();
  },
  setTrack,
  tracks: trackList,
  addSynth() {
    if (!seq.addSynth()) return;
    const i = seq.state.synths.length - 1;
    makeSynth(i, null);
    setTrack(synthTrack(i));
  },
  nextDemo: () => loadDemo(demoIndex + 1),
  reset() {
    loadSong(EMPTY);
    demoIndex = -1;
    snapshot = songJson();
    view.render();
  },
  demoName: () => (demoIndex >= 0 && !isDirty() ? DEMOS[demoIndex].name : null),
  isDirty,
  removeSynth(t) {
    const i = synthIndex(t);
    if (i < 1 || !engines.synths[i]) return;
    keys.releaseAll();
    engines.synths[i].dispose();
    engines.synths.splice(i, 1);
    panel.remove(t);
    // Las de detrás suben un puesto: sus cuerpos del panel, con ellas.
    for (let k = i; k < engines.synths.length; k++) panel.rename(synthTrack(k + 1), synthTrack(k));
    seq.removeSynth(i);
    setTrack(synthTrack(Math.min(i, engines.synths.length - 1)));
  },
});

// Tocar: la pista elegida. Con la caja, cada tecla blanca es un instrumento.
const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];
const voiceOf = (midi) => {
  const i = WHITE_OFFSETS.indexOf(midi - keys.base());
  return i >= 0 && i < VOICES.length ? i : null;
};
const keys = setupKeys(document.querySelector('[data-keys]'), {
  noteOn(midi) {
    wake();
    hitNow();
    if (track === 'drums') {
      const v = voiceOf(midi);
      if (v == null) return;
      engines.drums.trigger(v);
      seq.noteOn('drums', v);
    } else {
      liveEngine(track)?.noteOn(midi);
      seq.noteOn(track, midi);
    }
  },
  noteOff(midi) {
    if (track === 'drums') {
      const v = voiceOf(midi);
      if (v != null) seq.noteOff('drums', v);
    } else {
      liveEngine(track)?.noteOff(midi);
      seq.noteOff(track, midi);
    }
  },
  releaseAll() {
    engines.synths.forEach((e) => e.releaseAll());
    engines.acid.releaseAll();
  },
});

function setTrack(t) {
  if (!trackList().some((x) => x.id === t)) t = synthTrack(0);
  keys.releaseAll();
  track = t;
  panel.show(t, nameOf(t));
  keys.setNames(t === 'drums' ? VOICES : null);
  view.setTrack(t);
  save();
}
// La pista guardada («synth», de antes de que hubiera varias, es la primera).
setTrack(saved?.track === 'synth' ? synthTrack(0) : saved?.track ?? synthTrack(0));

// Atajos: espacio, play/stop; 1, 2, 3…, las pistas (en el orden de sus pestañas);
// retroceso, borrar el paso marcado.
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest?.('input[type="number"], textarea')) return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (e.repeat) return;
    wake();
    seq.toggle();
  } else if (/^Digit[1-9]$/.test(e.code)) {
    const t = trackList()[Number(e.code.slice(5)) - 1];
    if (t) setTrack(t.id);
  } else if (e.code === 'Backspace' || e.code === 'Delete') {
    e.preventDefault();
    seq.clearStep(track);
  }
});

// ---- Otra canción entera: una demo o «new» ----
// Los sonidos parten de los de serie (las demos solo llevan lo que cambia); las pistas de
// synth se crean o se quitan hasta que haya las de la canción. Si estaba sonando, sigue.
function loadSong(next) {
  keys.releaseAll();
  engines.acid.load({ ...ACID_DEFAULTS, ...next.acid });
  engines.drums.load({ ...DRUM_DEFAULTS, ...next.drums });
  seq.load(next.seq);
  const count = seq.state.synths.length;
  while (engines.synths.length > count) {
    const i = engines.synths.length - 1;
    engines.synths[i].dispose();
    engines.synths.pop();
    panel.remove(synthTrack(i));
  }
  for (let i = 0; i < count; i++) {
    if (!engines.synths[i]) makeSynth(i, null);
    engines.synths[i].load({ ...SYNTH_DEFAULTS, ...(next.synths?.[i] || {}) });
  }
  panel.refreshAll();
  setTrack(track);
}

function isDirty() {
  return songJson() !== snapshot;
}
function loadDemo(i) {
  demoIndex = ((i % DEMOS.length) + DEMOS.length) % DEMOS.length;
  loadSong(DEMOS[demoIndex]);
  snapshot = songJson();
  view.render();
}

ready = true;
if (startDemo >= 0) loadDemo(startDemo);

// Compartir: un enlace con la canción. La que llegó por enlace ya es de aquí: se guarda y
// la dirección se queda limpia.
setupShare(() => (shareCode ? songUrl(shareCode) : null));
if (shared) {
  clearSongFromUrl();
  save();
} else refreshShare();

// El cursor, de −1 a 1 en cada eje, para el parallax; se queda donde lo dejes.
const pointer = { x: 0, y: 0 };
const eased = { x: 0, y: 0 };
window.addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = 1 - (e.clientY / innerHeight) * 2;
});

// Arrastrar la esfera para girarla (visual.js): con el ratón o el dedo, sobre el dibujo.
const toShort = (e) => {
  const short = Math.min(canvas.clientWidth, canvas.clientHeight) || 1;
  return [e.clientX / short, -e.clientY / short];
};
canvas.addEventListener('pointerdown', (e) => {
  if (!e.isPrimary) return;
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('is-dragging');
  visual.grab(...toShort(e));
});
canvas.addEventListener('pointermove', (e) => {
  if (e.isPrimary && visual.dragging) visual.move(...toShort(e));
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(type, (e) => {
    if (!e.isPrimary || !visual.dragging) return;
    canvas.classList.remove('is-dragging');
    visual.release();
  });
}

// Cada fotograma.
const bands = new Float32Array(BANDS);
const eye = new THREE.Vector3();
const target = new THREE.Vector3();
let last = performance.now();
renderer.setAnimationLoop((now) => {
  // Si la pestaña estuvo escondida, dt sería enorme: lo limitamos.
  const dt = Math.min((now - last) / 1000, 1 / 20);
  last = now;

  // La cámara, con pereza tras el cursor.
  const ease = 1 - Math.exp(-dt * 3);
  eased.x += (pointer.x - eased.x) * ease;
  eased.y += (pointer.y - eased.y) * ease;
  const look = LOOKS[mode];
  eye.set(...look.eye).multiplyScalar(away);
  eye.x += eased.x * PARALLAX * away;
  eye.y += eased.y * PARALLAX * 0.6 * away;
  target.set(...look.target);
  camera.position.copy(eye);
  camera.lookAt(target);
  scene.fog.near = look.fog[0] * away;
  scene.fog.far = look.fog[1] * away;

  // El sonido, en bandas, y lo reciente que es el último golpe.
  toBands(bus.spectrum(), bus.sampleRate(), bands);
  const hit = Math.exp(-(now - lastHit) / 250);
  visual.update(dt, bands, bus.waveform(), hit, kicked);
  kicked = false;

  renderer.render(scene, camera);
});
