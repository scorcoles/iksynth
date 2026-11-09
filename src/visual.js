// =========================================================================================
// Lo que se ve: el sonido dibujado, de tres maneras
// =========================================================================================
//
//   ridge → el espectro como una cordillera: cada instante, una línea (los graves a la
//           izquierda, los agudos a la derecha) que se aleja hacia el fondo; cada línea
//           tapa las de detrás.
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

// ---- ridge ---------------------------------------------------------------------------------

// Cuántas líneas hay a la vez, cuántas nacen por segundo, lo ancha y lo alta que es la
// cordillera y la distancia entre líneas.
const ROWS = 64;
const ROWS_PER_SECOND = 28;
const RIDGE_WIDTH = 4.2;
const RIDGE_HEIGHT = 1.15;
const ROW_GAP = 0.085;

function createRidge() {
  const P = BANDS;
  const history = new Float32Array(ROWS * P);
  // Un poco de ruido quieto por línea, para que sin sonido no sea una rejilla muerta.
  const grain = new Float32Array(ROWS * P);

  // Las líneas: P puntos por fila, unidos de dos en dos.
  const linePos = new Float32Array(ROWS * P * 3);
  const lineIndex = [];
  for (let r = 0; r < ROWS; r++) for (let i = 0; i < P - 1; i++) lineIndex.push(r * P + i, r * P + i + 1);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3).setUsage(THREE.DynamicDrawUsage));
  lineGeo.setIndex(lineIndex);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, fog: true });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  lines.frustumCulled = false;

  // Las cortinas: debajo de cada línea, una tira del color de la página hasta el suelo,
  // que tapa las de detrás. Un pelo más atrás que su línea, para que la línea se vea.
  const curtainPos = new Float32Array(ROWS * P * 2 * 3);
  const curtainIndex = [];
  for (let r = 0; r < ROWS; r++) {
    for (let i = 0; i < P - 1; i++) {
      const a = (r * P + i) * 2;
      curtainIndex.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const curtainGeo = new THREE.BufferGeometry();
  curtainGeo.setAttribute('position', new THREE.BufferAttribute(curtainPos, 3).setUsage(THREE.DynamicDrawUsage));
  curtainGeo.setIndex(curtainIndex);
  const curtainMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const curtains = new THREE.Mesh(curtainGeo, curtainMat);
  curtains.frustumCulled = false;

  const group = new THREE.Group();
  group.add(curtains, lines);

  let head = 0; // la fila más nueva, en el anillo de history
  let phase = 0; // cuánto ha avanzado hacia el fondo la fila más nueva (0–1)

  function push(bands) {
    head = (head + 1) % ROWS;
    for (let i = 0; i < P; i++) {
      history[head * P + i] = bands[i];
      grain[head * P + i] = Math.random();
    }
  }

  function update(dt, bands) {
    phase += dt * ROWS_PER_SECOND;
    while (phase >= 1) {
      phase -= 1;
      push(bands);
    }
    // La fila más nueva, siempre al día (no espera a nacer la siguiente).
    for (let i = 0; i < P; i++) history[head * P + i] = Math.max(history[head * P + i] * 0.6, bands[i]);

    for (let k = 0; k < ROWS; k++) {
      const slot = (head - k + ROWS) % ROWS;
      const z = -(k + phase) * ROW_GAP;
      for (let i = 0; i < P; i++) {
        const u = i / (P - 1);
        // Los bordes, más tranquilos: una campana muy abierta.
        const edge = Math.sin(Math.PI * u) ** 0.35;
        const y = (history[slot * P + i] * RIDGE_HEIGHT + grain[slot * P + i] * 0.012) * edge;
        const x = (u - 0.5) * RIDGE_WIDTH;
        const v = (k * P + i) * 3;
        linePos[v] = x;
        linePos[v + 1] = y;
        linePos[v + 2] = z;
        const c = (k * P + i) * 6;
        curtainPos[c] = x;
        curtainPos[c + 1] = y;
        curtainPos[c + 2] = z;
        curtainPos[c + 3] = x;
        curtainPos[c + 4] = -0.05;
        curtainPos[c + 5] = z;
      }
    }
    lineGeo.attributes.position.needsUpdate = true;
    curtainGeo.attributes.position.needsUpdate = true;
  }

  function setColors(page, ink) {
    lineMat.color.set(ink);
    curtainMat.color.set(page);
  }

  return { object: group, update, setColors, depth: ROWS * ROW_GAP };
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

export function createVisual(scene) {
  const ridge = createRidge();
  const orb = createOrb();
  scene.add(ridge.object, orb.object);
  scene.fog = new THREE.Fog(0x000000, 2, 9);

  let look = 'ridge';

  return {
    ridgeDepth: ridge.depth,

    setLook(name, page, ink, pixelRatio) {
      look = name;
      ridge.object.visible = look === 'ridge';
      orb.object.visible = look !== 'ridge';
      ridge.setColors(page, ink);
      orb.setLook(look, ink, pixelRatio);
      scene.fog.color.set(page);
    },

    // bands: el espectro en bandas (0–1); wave: la onda (−1 a 1); hit: lo reciente que es
    // la última nota (1 recién pulsada, 0 hace rato); kicked: si acaba de pulsarse una.
    update(dt, bands, wave, hit, kicked) {
      if (look === 'ridge') ridge.update(dt, bands);
      else orb.update(dt, bands, wave, hit, kicked);
    },
  };
}
