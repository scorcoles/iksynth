// =========================================================================================
// El panel: los controles del sonido de la pista elegida (synth, acid o drums)
// =========================================================================================
//
// Un bloque del color de la tinta, como el pie, con la letra del color de la página.
// Plegable con su cabecera; abierto de entrada solo en escritorio. Cada pista tiene su
// cuerpo (presets si los tiene, random y sus secciones); se ve el de la pista elegida.
// Los deslizadores que abarcan mucho (tiempos, frecuencias) van en escala logarítmica: la
// mitad del recorrido es la media geométrica, no la aritmética.

import { PRESETS, JITTER } from './synth.js';
import { ACID_PRESETS, ACID_JITTER } from './acid.js';
import { VOICES } from './drums.js';

const hz = (v) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 1 : 2)}k` : `${Math.round(v)}`);
const sec = (v) => (v < 1 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(v < 10 ? 2 : 1)}s`);
const pct = (v) => `${Math.round(v * 100)}%`;
const db = (v) => `${v.toFixed(1)}db`;
const semi = (v) => `${v > 0 ? '+' : ''}${v}st`;
const times = (v) => `×${v.toFixed(2)}`;

// Las secciones y sus controles, por pista. «choice»: botones, uno elegido; si no, un
// deslizador.
const SYNTH_SECTIONS = [
  {
    title: 'osc',
    rows: [
      { key: 'wave', choice: [['sine', 'sin'], ['triangle', 'tri'], ['sawtooth', 'saw'], ['square', 'sqr']] },
      { key: 'unison', label: 'voices', min: 1, max: 7, step: 1, format: (v) => `${v}` },
      { key: 'spread', label: 'spread', min: 0, max: 60, step: 1, format: (v) => `${v}ct` },
    ],
  },
  {
    title: 'amp',
    rows: [
      { key: 'attack', label: 'attack', min: 0.001, max: 4, log: true, format: sec },
      { key: 'decay', label: 'decay', min: 0.01, max: 4, log: true, format: sec },
      { key: 'sustain', label: 'sustain', min: 0, max: 1, format: pct },
      { key: 'release', label: 'release', min: 0.01, max: 8, log: true, format: sec },
    ],
  },
  {
    title: 'filter',
    rows: [
      { key: 'cutoff', label: 'cutoff', min: 40, max: 12000, log: true, format: hz },
      { key: 'resonance', label: 'reso', min: 0.1, max: 18, format: (v) => v.toFixed(1) },
      { key: 'envAmount', label: 'env', min: 0, max: 6, format: (v) => `${v.toFixed(1)}oct` },
      { key: 'envDecay', label: 'env decay', min: 0.01, max: 3, log: true, format: sec },
    ],
  },
  {
    title: 'lfo',
    rows: [
      { key: 'lfoTarget', choice: [['filter', 'filter'], ['pitch', 'pitch'], ['amp', 'amp']] },
      { key: 'lfoRate', label: 'rate', min: 0.05, max: 12, log: true, format: (v) => `${v.toFixed(2)}hz` },
      { key: 'lfoDepth', label: 'depth', min: 0, max: 1, format: pct },
    ],
  },
  {
    title: 'fx',
    rows: [
      { key: 'drive', label: 'drive', min: 0, max: 1, format: pct },
      { key: 'chorus', label: 'chorus', min: 0, max: 1, format: pct },
      { key: 'delay', label: 'delay', min: 0, max: 1, format: pct },
      { key: 'delayTime', label: 'time', min: 0.03, max: 1, log: true, format: sec },
      { key: 'feedback', label: 'feedback', min: 0, max: 0.9, format: pct },
      { key: 'reverb', label: 'reverb', min: 0, max: 1, format: pct },
      { key: 'size', label: 'size', min: 0.4, max: 10, log: true, format: sec },
    ],
  },
  {
    title: 'out',
    rows: [{ key: 'volume', label: 'volume', min: -40, max: 0, step: 0.5, format: db }],
  },
];

const ACID_SECTIONS = [
  {
    title: 'voice',
    rows: [
      { key: 'wave', choice: [['sawtooth', 'saw'], ['square', 'sqr']] },
      { key: 'cutoff', label: 'cutoff', min: 40, max: 5000, log: true, format: hz },
      { key: 'resonance', label: 'reso', min: 0.5, max: 25, format: (v) => v.toFixed(1) },
      { key: 'envAmount', label: 'env mod', min: 0, max: 6, format: (v) => `${v.toFixed(1)}oct` },
      { key: 'envDecay', label: 'decay', min: 0.03, max: 1.5, log: true, format: sec },
      { key: 'accent', label: 'accent', min: 0, max: 1, format: pct },
    ],
  },
  {
    title: 'fx',
    rows: [
      { key: 'drive', label: 'drive', min: 0, max: 1, format: pct },
      { key: 'delay', label: 'delay', min: 0, max: 1, format: pct },
      { key: 'delayTime', label: 'time', min: 0.03, max: 1, log: true, format: sec },
      { key: 'feedback', label: 'feedback', min: 0, max: 0.9, format: pct },
    ],
  },
  {
    title: 'out',
    rows: [{ key: 'volume', label: 'volume', min: -40, max: 0, step: 0.5, format: db }],
  },
];

const DRUM_SECTIONS = [
  ...VOICES.map((v) => ({
    title: v,
    rows: [
      { key: `${v}Level`, label: 'level', min: -40, max: 6, step: 0.5, format: db },
      { key: `${v}Tune`, label: 'tune', min: -12, max: 12, step: 1, format: semi },
      { key: `${v}Decay`, label: 'decay', min: 0.25, max: 3, log: true, format: times },
    ],
  })),
  {
    title: 'out',
    rows: [{ key: 'volume', label: 'volume', min: -40, max: 0, step: 0.5, format: db }],
  },
];

export const PANELS = {
  synth: { sections: SYNTH_SECTIONS, presets: Object.keys(PRESETS), jitter: JITTER },
  acid: { sections: ACID_SECTIONS, presets: Object.keys(ACID_PRESETS), jitter: ACID_JITTER },
  drums: { sections: DRUM_SECTIONS },
};

// De la posición del deslizador (0–1000) al valor, y al revés.
const STEPS = 1000;
const toValue = (row, s) => {
  const t = s / STEPS;
  let v = row.log ? row.min * (row.max / row.min) ** t : row.min + (row.max - row.min) * t;
  if (row.step) v = Math.round(v / row.step) * row.step;
  return v;
};
const toSlider = (row, v) => {
  const t = row.log ? Math.log(v / row.min) / Math.log(row.max / row.min) : (v - row.min) / (row.max - row.min);
  return Math.round(Math.max(0, Math.min(1, t)) * STEPS);
};

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

// Un cuerpo del panel: el de una pista. engine: su sonido (params, set, defaults y, si
// tiene presets, preset). onEdit: se llama con cada cambio (para guardar).
function buildBody(spec, engine, onEdit) {
  const body = el('div', 'synth__body');
  const refreshers = [];
  const refresh = () => refreshers.forEach((f) => f());
  let preset = spec.presets?.[0] ?? null;

  // Los presets y random: una variación del preset elegido (JITTER de cada pista), dentro
  // de los límites de cada deslizador.
  if (spec.presets) {
    const box = el('div', 'synth__section');
    box.append(el('h2', 'synth__title', 'preset'));
    const row = el('div', 'synth__choice');
    for (const name of spec.presets) {
      const b = el('button', null, name);
      b.type = 'button';
      b.addEventListener('click', () => {
        preset = name;
        engine.preset(name);
        refresh();
        onEdit();
      });
      refreshers.push(() => b.classList.toggle('is-on', preset === name));
      row.append(b);
    }
    box.append(row);

    const limits = Object.fromEntries(spec.sections.flatMap((s) => s.rows).filter((r) => !r.choice).map((r) => [r.key, r]));
    const random = el('button', 'synth__random', 'random');
    random.type = 'button';
    random.setAttribute('aria-label', 'Una variación al azar del preset (tecla R)');
    random.addEventListener('click', () => body.randomize());
    body.randomize = () => {
      const base = engine.defaults(preset);
      const spread = (amount) => (Math.random() * 2 - 1) * amount;
      for (const [key, { mul, add, step }] of Object.entries(spec.jitter)) {
        const from = base[key];
        if (!from) {
          engine.set(key, from);
          continue;
        }
        let v = mul ? from * 2 ** spread(mul) : from + spread(add);
        const { min, max, step: rowStep } = limits[key];
        const by = step || rowStep;
        if (by) v = Math.round(v / by) * by;
        engine.set(key, Math.max(min, Math.min(max, v)));
      }
      refresh();
      onEdit();
    };
    box.append(random);
    body.append(box);
  }

  for (const section of spec.sections) {
    const box = el('div', 'synth__section');
    box.append(el('h2', 'synth__title', section.title));
    for (const row of section.rows) {
      if (row.choice) {
        const wrap = el('div', 'synth__choice');
        wrap.setAttribute('role', 'group');
        wrap.setAttribute('aria-label', row.key);
        for (const [value, text] of row.choice) {
          const b = el('button', null, text);
          b.type = 'button';
          b.addEventListener('click', () => {
            engine.set(row.key, value);
            refresh();
            onEdit();
          });
          refreshers.push(() => {
            const on = engine.params[row.key] === value;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', String(on));
          });
          wrap.append(b);
        }
        box.append(wrap);
        continue;
      }
      const line = el('label', 'synth__row');
      const name = el('span', 'synth__label', row.label);
      const input = el('input');
      input.type = 'range';
      input.min = 0;
      input.max = STEPS;
      input.step = 1;
      const out = el('span', 'synth__value');
      input.addEventListener('input', () => {
        const v = toValue(row, Number(input.value));
        engine.set(row.key, v);
        out.textContent = row.format(v);
        onEdit();
      });
      // Doble clic: vuelve al valor del preset (o al de serie).
      input.addEventListener('dblclick', () => {
        engine.set(row.key, engine.defaults(preset)[row.key]);
        refresh();
        onEdit();
      });
      refreshers.push(() => {
        input.value = toSlider(row, engine.params[row.key]);
        out.textContent = row.format(engine.params[row.key]);
      });
      line.append(name, input, out);
      box.append(line);
    }
    body.append(box);
  }

  refresh();
  return body;
}

// root: el <aside> del panel. onEdit: algo cambió (para guardar). Cada pista añade su
// cuerpo con add(track, kind, engine) y lo quita con remove(track); show(track, name)
// enseña el suyo.
export function createPanel(root, onEdit) {
  // La cabecera: el nombre de la pista y plegar/desplegar.
  const head = el('button', 'synth__head');
  head.type = 'button';
  head.innerHTML = '<span data-panel-name></span><span class="synth__fold" aria-hidden="true"></span>';
  const nameEl = head.querySelector('[data-panel-name]');
  root.append(head);

  const bodies = new Map();
  let serial = 0;

  const setOpen = (open) => {
    root.classList.toggle('is-open', open);
    head.setAttribute('aria-expanded', String(open));
  };
  head.addEventListener('click', () => setOpen(!root.classList.contains('is-open')));
  setOpen(matchMedia('(min-width: 64rem) and (pointer: fine)').matches);

  let current = null;

  // R: random en la pista elegida (si tiene presets).
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyR' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select')) return;
    bodies.get(current)?.randomize?.();
  });

  return {
    add(track, kind, engine) {
      const body = buildBody(PANELS[kind], engine, onEdit);
      body.id = `panel-${kind}-${serial++}`;
      body.hidden = true;
      root.append(body);
      bodies.set(track, body);
    },
    remove(track) {
      bodies.get(track)?.remove();
      bodies.delete(track);
    },
    // Las pistas de synth se nombran por su sitio: al quitar una, las de detrás cambian
    // de nombre; sus cuerpos, con ellas.
    rename(from, to) {
      const body = bodies.get(from);
      if (!body) return;
      bodies.delete(from);
      bodies.set(to, body);
    },
    show(track, name) {
      current = track;
      for (const [t, body] of bodies) body.hidden = t !== track;
      nameEl.textContent = name;
      if (bodies.has(track)) head.setAttribute('aria-controls', bodies.get(track).id);
    },
  };
}
