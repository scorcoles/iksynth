// =========================================================================================
// iksynth: un sintetizador en el navegador, con su sonido dibujado en tiempo real
// =========================================================================================
//
// Un experimento de VERTIK. Se toca con el teclado del ordenador o con el de la pantalla;
// el panel de la derecha cambia el sonido (oscilador, envolvente, filtro, LFO y efectos), y
// lo que suena se dibuja mientras suena.
//
//   synth.js  → el sonido: Tone.js, las voces, el LFO, los efectos y los analizadores
//   visual.js → lo que se ve: la cordillera del espectro, la esfera y su malla
//   panel.js  → el panel del sinte
//   keys.js   → tocar: el teclado del ordenador y el de la pantalla
//   share.js  → compartir una foto
//   main.js   → el escenario, la cámara, los modos y el bucle (este archivo)
//
// Tres modos, con «Prev» y «Next» en el pie, las flechas del teclado o la dirección
// (#orb, #wire): «ridge», el espectro como una cordillera, lima apagado sobre grafito; «orb», una
// esfera de puntos que respira con el sonido, azul hielo sobre negro azulado; y «wire», la
// misma esfera en malla gris sobre papel.

import * as THREE from 'three';
import { createSynth } from './synth.js';
import { createVisual, toBands, BANDS } from './visual.js';
import { createPanel } from './panel.js';
import { setupKeys } from './keys.js';
import { setupShare } from './share.js';
import '../style.css';

// Los modos: el color de la página y el de la tinta, y desde dónde mira la cámara (su
// sitio y adónde mira, para una pantalla apaisada; en vertical, se aleja).
const LOOKS = {
  ridge: { page: '#141514', ink: '#a6bf5c', eye: [0, 1.5, 3.4], target: [0, 0.15, -1.9], fog: [3.6, 9.5] },
  orb: { page: '#070a12', ink: '#a9c9ff', eye: [0, 0, 4.8], target: [0, -0.22, 0], fog: [4.2, 6.2] },
  wire: { page: '#eeeeee', ink: '#333333', eye: [0, 0, 4.8], target: [0, -0.22, 0], fog: [4.2, 6.4] },
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
const fromHash = () => setMode(decodeURIComponent(location.hash.slice(1)));
window.addEventListener('hashchange', fromHash);
fromHash();

// El sinte y su panel.
const synth = createSynth();
createPanel(document.querySelector('[data-panel]'), synth);

// El altavoz de arriba: apagado de entrada. Como esto es un instrumento, la primera nota
// lo enciende sola (si no se ha tocado antes el botón); después, manda el botón.
const soundButton = document.querySelector('[data-sound]');
let soundOn = false;
let soundTouched = false;
function setSound(on) {
  soundOn = on;
  synth.setMuted(!on);
  if (on) synth.start();
  soundButton?.classList.toggle('is-on', on);
  soundButton?.setAttribute('aria-pressed', String(on));
  soundButton?.setAttribute('aria-label', on ? 'Apagar el sonido' : 'Encender el sonido');
}
synth.setMuted(true);
soundButton?.addEventListener('click', () => {
  soundTouched = true;
  setSound(!soundOn);
});

// Tocar. Aunque el sonido esté apagado, se dibuja.
let kicked = false;
setupKeys(document.querySelector('[data-keys]'), synth, () => {
  synth.start();
  if (!soundTouched && !soundOn) setSound(true);
  kicked = true;
});

// Compartir: una foto, con el marco del color de la página.
setupShare(canvas, () => renderer.render(scene, camera), () => ({ background: LOOKS[mode].page, ink: LOOKS[mode].ink }));

// El cursor, de −1 a 1 en cada eje, para el parallax; se queda donde lo dejes.
const pointer = { x: 0, y: 0 };
const eased = { x: 0, y: 0 };
window.addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = 1 - (e.clientY / innerHeight) * 2;
});

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

  // El sonido, en bandas, y lo reciente que es la última nota.
  toBands(synth.spectrum(), synth.sampleRate(), bands);
  const hit = Math.exp(-(now - synth.lastHit()) / 250);
  visual.update(dt, bands, synth.waveform(), hit, kicked);
  kicked = false;

  renderer.render(scene, camera);
});
