// =========================================================================================
// Lo que se ve: el sonido dibujado en una esfera, de dos maneras
// =========================================================================================
//
//   orb   → una esfera de puntos que respira con el sonido: los graves empujan el ecuador,
//           los agudos los polos, y la onda la riza alrededor.
//   wire  → la misma esfera, en malla gris sobre papel.
//
// Todo se calcula en la CPU cada fotograma (son pocos miles de puntos) y se sube a la
// tarjeta tal cual.

import * as THREE from 'three';

// El espectro, en bandas: cuántas, y de qué frecuencia a cuál (repartidas como las oye el
// oído, cada octava lo mismo).
export const BANDS = 160;
const F_MIN = 35;
const F_MAX = 14000;

// De decibelios a 0–1: lo que queda por debajo del suelo no se ve.
const DB_FLOOR = -95;
const DB_RANGE = 70;

// Del espectro del analizador (en dB, de 0 Hz a la mitad del muestreo) a BANDS bandas de 0
// a 1. En los graves, cada banda cae entre dos casillas del analizador: se interpola; en
// los agudos, abarca muchas: se toma la más alta.
export function toBands(db, sampleRate, out) {
  const bins = db.length;
  const hzPerBin = sampleRate / 2 / bins;
  const level = (v) => Math.max(0, Math.min(1, (v - DB_FLOOR) / DB_RANGE));
  for (let b = 0; b < BANDS; b++) {
    const f0 = F_MIN * (F_MAX / F_MIN) ** (b / BANDS);
    const f1 = F_MIN * (F_MAX / F_MIN) ** ((b + 1) / BANDS);
    const i0 = f0 / hzPerBin;
    const i1 = f1 / hzPerBin;
    let v;
    if (i1 - i0 < 1) {
      const i = Math.floor(i0);
      const t = i0 - i;
      v = db[i] * (1 - t) + db[Math.min(bins - 1, i + 1)] * t;
    } else {
      v = -Infinity;
      for (let i = Math.floor(i0); i < Math.ceil(i1) && i < bins; i++) v = Math.max(v, db[i]);
    }
    // Un poco de curva: lo flojo, más flojo; lo fuerte destaca.
    out[b] = level(v) ** 1.4;
  }
  // Un pelo de suavizado con las vecinas: los valles entre armónicos, menos cortantes.
  let prev = out[0];
  for (let b = 1; b < BANDS - 1; b++) {
    const here = out[b];
    out[b] = Math.max(here, (prev + here * 2 + out[b + 1]) / 4);
    prev = here;
  }
  return out;
}

// ---- orb y wire ------------------------------------------------------------------------------

// Cuánto se hincha la esfera con el espectro y con la onda, y con cada nota.
const ORB_SPECTRUM = 0.42;
const ORB_WAVE = 0.18;
const ORB_HIT = 0.08;

// La esfera no usa el espectro y la onda tal cual: entre armónicos, una banda salta de 0
// a 1 y la de al lado no, y eso la llenaría de pinchos. Se suavizan los dos.
const SOFT_RADIUS = 5;
const WAVE_POINTS = 64;
const softBands = new Float32Array(BANDS);
const softWave = new Float32Array(WAVE_POINTS);
const scratch = new Float32Array(BANDS);

// Un desenfoque de caja, dos veces (casi una campana).
function soften(bands) {
  const pass = (from, to) => {
    for (let i = 0; i < BANDS; i++) {
      let sum = 0;
      let n = 0;
      for (let j = i - SOFT_RADIUS; j <= i + SOFT_RADIUS; j++) {
        if (j < 0 || j >= BANDS) continue;
        sum += from[j];
        n++;
      }
      to[i] = sum / n;
    }
  };
  pass(bands, scratch);
  pass(scratch, softBands);
  return softBands;
}
// La onda, en 64 tramos (la media de cada uno).
function softenWave(wave) {
  const per = Math.floor(wave.length / WAVE_POINTS);
  for (let i = 0; i < WAVE_POINTS; i++) {
    let sum = 0;
    for (let j = 0; j < per; j++) sum += wave[i * per + j];
    softWave[i] = sum / per;
  }
}
const lerpAt = (arr, t, wrap) => {
  const n = arr.length;
  const i = Math.floor(t);
  const f = t - i;
  const a = arr[wrap ? ((i % n) + n) % n : Math.min(n - 1, i)];
  const b = arr[wrap ? (((i + 1) % n) + n) % n : Math.min(n - 1, i + 1)];
  return a + (b - a) * f;
};

// Para un punto de la esfera (dirección unitaria x, y, z): su radio con el sonido.
function radius(x, y, z, hit) {
  // Del ecuador (graves) a los polos (agudos). Casi todo lo que suena cae en la mitad
  // baja del espectro: se estira para que ocupe más esfera.
  const b = Math.abs(y) ** 1.6 * (BANDS - 1);
  // La onda, alrededor (por el ángulo en el plano del ecuador).
  const a = (Math.atan2(z, x) / (Math.PI * 2) + 0.5) * WAVE_POINTS;
  return 0.85 + lerpAt(softBands, b) * ORB_SPECTRUM + lerpAt(softWave, a, true) * ORB_WAVE * (1 - Math.abs(y)) + hit * ORB_HIT;
}

// Los puntos redondos, del mismo tamaño en pantalla a cualquier distancia.
const pointVertex = /* glsl */ `
  uniform float uSize;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize;
  }
`;
const pointFragment = /* glsl */ `
  uniform vec3 uColor;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    if (dot(p, p) > 0.25) discard;
    gl_FragColor = vec4(uColor, 1.0);
  }
`;

function createOrb() {
  // Los puntos, repartidos por igual (la espiral de Fibonacci).
  const N = 4200;
  const dirs = new Float32Array(N * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    dirs[i * 3] = Math.cos(golden * i) * r;
    dirs[i * 3 + 1] = y;
    dirs[i * 3 + 2] = Math.sin(golden * i) * r;
  }
  const pointPos = new Float32Array(N * 3);
  const pointGeo = new THREE.BufferGeometry();
  pointGeo.setAttribute('position', new THREE.BufferAttribute(pointPos, 3).setUsage(THREE.DynamicDrawUsage));
  const pointMat = new THREE.ShaderMaterial({
    uniforms: { uSize: { value: 2 }, uColor: { value: new THREE.Color() } },
    vertexShader: pointVertex,
    fragmentShader: pointFragment,
  });
  const points = new THREE.Points(pointGeo, pointMat);
  points.frustumCulled = false;

  // La malla: las aristas de un icosaedro muy subdividido.
  const wireBase = new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1, 7));
  const wireDirs = wireBase.attributes.position.array.slice();
  for (let i = 0; i < wireDirs.length; i += 3) {
    const l = Math.hypot(wireDirs[i], wireDirs[i + 1], wireDirs[i + 2]);
    wireDirs[i] /= l;
    wireDirs[i + 1] /= l;
    wireDirs[i + 2] /= l;
  }
  const wirePos = new Float32Array(wireDirs.length);
  const wireGeo = new THREE.BufferGeometry();
  wireGeo.setAttribute('position', new THREE.BufferAttribute(wirePos, 3).setUsage(THREE.DynamicDrawUsage));
  const wireMat = new THREE.LineBasicMaterial({ color: 0xffffff });
  const wire = new THREE.LineSegments(wireGeo, wireMat);
  wire.frustumCulled = false;

  const group = new THREE.Group();
  group.add(points, wire);

  // El giro: lento siempre, y cada nota le da un empujón que se va frenando.
  let spin = 0;
  let spinSpeed = 0;

  function shape(dirsArr, pos, hit) {
    for (let i = 0; i < dirsArr.length; i += 3) {
      const x = dirsArr[i];
      const y = dirsArr[i + 1];
      const z = dirsArr[i + 2];
      const r = radius(x, y, z, hit);
      pos[i] = x * r;
      pos[i + 1] = y * r;
      pos[i + 2] = z * r;
    }
  }

  function update(dt, bands, wave, hit, kicked) {
    if (kicked) spinSpeed += 0.9;
    spinSpeed *= Math.exp(-dt * 1.5);
    spin += (0.12 + spinSpeed) * dt;
    group.rotation.set(0.35, spin, 0);
    soften(bands);
    softenWave(wave);
    if (points.visible) {
      shape(dirs, pointPos, hit);
      pointGeo.attributes.position.needsUpdate = true;
    }
    if (wire.visible) {
      shape(wireDirs, wirePos, hit);
      wireGeo.attributes.position.needsUpdate = true;
    }
  }

  function setLook(look, ink, pixelRatio) {
    points.visible = look === 'orb';
    wire.visible = look === 'wire';
    pointMat.uniforms.uColor.value.set(ink);
    pointMat.uniforms.uSize.value = 2.2 * pixelRatio;
    wireMat.color.set(ink);
  }

  return { object: group, update, setLook };
}

// ---- todo junto -----------------------------------------------------------------------------

// Arrastrar la esfera: gira con el dedo o el ratón alrededor del eje perpendicular al
// gesto (en horizontal, el vertical; en vertical, el horizontal; en diagonal, uno
// inclinado) y, al soltarla, sigue por inercia y se va frenando. Cuanto más largo el
// arrastre, más le cuesta frenar: de FRICTION_MAX (uno cortito) a FRICTION_MIN (uno de
// media pantalla o más), por segundo.
const DRAG_TURN = 3.2; // radianes por pantalla arrastrada
const FRICTION_MAX = 3.5;
const FRICTION_MIN = 0.35;
const SPIN_MAX = 14; // radianes por segundo, como mucho

export function createVisual(scene) {
  const orb = createOrb();
  // El giro a mano va por fuera; el lento de siempre y los empujones, por dentro.
  const holder = new THREE.Group();
  holder.add(orb.object);
  scene.add(holder);
  scene.fog = new THREE.Fog(0x000000, 2, 9);

  const axis = new THREE.Vector3();
  const turn = new THREE.Quaternion();
  // La inercia: hacia dónde gira (eje) y cuánto (radianes por segundo), y su rozamiento.
  const spinAxis = new THREE.Vector3(0, 1, 0);
  let spin = 0;
  let friction = FRICTION_MAX;
  // El arrastre en curso: lo recorrido (en pantallas) y los últimos movimientos, para la
  // velocidad al soltar.
  let drag = null;

  const rotate = (dx, dy, angle) => {
    axis.set(-dy, dx, 0);
    if (axis.lengthSq() < 1e-12 || !angle) return;
    turn.setFromAxisAngle(axis.normalize(), angle);
    holder.quaternion.premultiply(turn);
  };

  return {
    // x, y: el puntero, en pantallas (0–1 en el lado corto), con y hacia arriba.
    grab(x, y) {
      drag = { x, y, path: 0, moves: [] };
      spin = 0;
    },
    move(x, y) {
      if (!drag) return;
      const dx = x - drag.x;
      const dy = y - drag.y;
      drag.x = x;
      drag.y = y;
      const d = Math.hypot(dx, dy);
      drag.path += d;
      rotate(dx, dy, d * DRAG_TURN);
      const now = performance.now();
      drag.moves.push({ dx, dy, t: now });
      while (drag.moves.length && now - drag.moves[0].t > 90) drag.moves.shift();
    },
    release() {
      if (!drag) return;
      // La velocidad de los últimos 90 ms (si se paró antes de soltar, no hay inercia).
      const now = performance.now();
      const recent = drag.moves.filter((m) => now - m.t <= 90);
      let sx = 0;
      let sy = 0;
      for (const m of recent) {
        sx += m.dx;
        sy += m.dy;
      }
      const span = recent.length ? Math.max(16, now - recent[0].t) / 1000 : 1;
      const speed = (Math.hypot(sx, sy) / span) * DRAG_TURN;
      spin = recent.length ? Math.min(SPIN_MAX, speed) : 0;
      spinAxis.set(-sy, sx, 0);
      if (spinAxis.lengthSq() > 1e-12) spinAxis.normalize();
      else spin = 0;
      const t = Math.min(1, drag.path / 0.5);
      friction = FRICTION_MAX + (FRICTION_MIN - FRICTION_MAX) * t;
      drag = null;
    },
    get dragging() {
      return !!drag;
    },

    setLook(look, page, ink, pixelRatio) {
      orb.setLook(look, ink, pixelRatio);
      scene.fog.color.set(page);
    },

    // bands: el espectro en bandas (0–1); wave: la onda (−1 a 1); hit: lo reciente que es
    // la última nota (1 recién pulsada, 0 hace rato); kicked: si acaba de pulsarse una.
    update(dt, bands, wave, hit, kicked) {
      if (!drag && spin > 0.001) {
        turn.setFromAxisAngle(spinAxis, spin * dt);
        holder.quaternion.premultiply(turn);
        spin *= Math.exp(-friction * dt);
      }
      orb.update(dt, bands, wave, hit, kicked);
    },
  };
}
