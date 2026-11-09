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

// Los iconos «serigrafiados» (solo se ven en el modo unit): uno por sección y por opción.
const svg = (d, w = 16) =>
  `<svg viewBox="0 0 ${w} 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const ICONS = {
  // Secciones.
  preset: svg('M2 2h4v3H2zM10 2h4v3h-4zM2 7h4v3H2zM10 7h4v3h-4z'),
  osc: svg('M1 6C3.5 1 5.5 1 8 6S12.5 11 15 6'),
  amp: svg('M1 11 4 1l3 4h4l3 6'),
  filter: svg('M1 4h7c2.5 0 3-2 4-2s1.5 5 3 9'),
  lfo: svg('M1 9 4.5 3 8 9l3.5-6L15 9'),
  fx: svg('M3 2q4 4 0 8M7 1q5 5 0 10M11 .5q6 5.5 0 11'),
  out: svg('M1 4h3l4-3v10L4 8H1zM11 3.5q2 2.5 0 5M13 1.5q3.5 4.5 0 9'),
  voice: svg('M1 10 7 2v8l6-8v8'),
  kick: svg('M8 1a5 5 0 1 0 0 10A5 5 0 1 0 8 1z'),
  snare: svg('M2 3h12v6H2zM2 3l12 6'),
  clap: svg('M4 11 6 3M8 11V2M12 11l-2-8'),
  hat: svg('M2 4h12M4 2h8M8 4v7'),
  open: svg('M2 5l12-2M2 2 14 0M8 4v7'),
  tom: svg('M3 3h10v7H3zM3 3q5 2 10 0'),
  cow: svg('M5 1h6l3 10H2z'),
  // Opciones.
  sine: svg('M1 6C4 0 8 0 12 6s8 6 11 0', 24),
  triangle: svg('M1 10 6.5 2 12 10l5.5-8L23 10', 24),
  sawtooth: svg('M1 10 11 2v8l10-8v8', 24),
  square: svg('M1 10V2h7v8h8V2h7', 24),
  pitch: svg('M8 1v10M5 4l3-3 3 3M5 8l3 3 3-3'),
  ampTarget: svg('M1 11 15 1v10z'),
};
const OPTION_ICONS = { sine: 'sine', triangle: 'triangle', sawtooth: 'sawtooth', square: 'square', filter: 'filter', pitch: 'pitch', amp: 'ampTarget' };
const iconEl = (name) => {
  const i = document.createElement('span');
  i.className = 'synth__icon';
  i.innerHTML = ICONS[name] || '';
  return i;
};
// El título de una sección: su icono y su nombre.
const titleEl = (name) => {
  const h = document.createElement('h2');
  h.className = 'synth__title';
  if (ICONS[name]) h.append(iconEl(name));
  h.append(document.createTextNode(name));
  return h;
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
    box.dataset.section = 'preset';
    box.append(titleEl('preset'));
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
    box.dataset.section = section.title;
    box.append(titleEl(section.title));
    for (const row of section.rows) {
      if (row.choice) {
        const wrap = el('div', 'synth__choice');
        wrap.setAttribute('role', 'group');
        wrap.setAttribute('aria-label', row.key);
        for (const [value, text] of row.choice) {
          const b = el('button');
          b.type = 'button';
          if (OPTION_ICONS[value]) b.append(iconEl(OPTION_ICONS[value]));
          b.append(document.createTextNode(text));
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
      // El knob (solo se ve en el modo unit): gira con el valor del deslizador, y
      // arrastrarlo hacia arriba o a la derecha lo sube (con mayúsculas, fino). El
      // deslizador sigue ahí, escondido, para el teclado y los lectores de pantalla.
      const knob = el('span', 'synth__knob');
      knob.setAttribute('aria-hidden', 'true');
      knob.append(el('span', 'synth__cap'));
      const showKnob = () => knob.style.setProperty('--t', String(Number(input.value) / STEPS));
      knob.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        knob.setPointerCapture(e.pointerId);
        input.focus({ preventScroll: true });
        let last = { x: e.clientX, y: e.clientY };
        let at = Number(input.value);
        const move = (ev) => {
          const d = last.y - ev.clientY + (ev.clientX - last.x);
          last = { x: ev.clientX, y: ev.clientY };
          at = Math.max(0, Math.min(STEPS, at + d * (ev.shiftKey ? 1 : 5)));
          const v = Math.round(at);
          if (v === Number(input.value)) return;
          input.value = v;
          input.dispatchEvent(new Event('input'));
        };
        const up = () => {
          knob.removeEventListener('pointermove', move);
          knob.removeEventListener('pointerup', up);
          knob.removeEventListener('pointercancel', up);
        };
        knob.addEventListener('pointermove', move);
        knob.addEventListener('pointerup', up);
        knob.addEventListener('pointercancel', up);
      });
      knob.addEventListener('dblclick', () => input.dispatchEvent(new MouseEvent('dblclick')));
      input.addEventListener('input', () => {
        const v = toValue(row, Number(input.value));
        engine.set(row.key, v);
        out.textContent = row.format(v);
        showKnob();
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
        showKnob();
      });
      line.append(name, input, knob, out);
      box.append(line);
    }
    body.append(box);
  }

  refresh();
  body.refresh = refresh;
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
      body.dataset.kind = kind;
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
    // Al cargar otra canción: todos los controles, con los valores nuevos.
    refreshAll() {
      for (const body of bodies.values()) body.refresh();
    },
    show(track, name) {
      current = track;
      for (const [t, body] of bodies) body.hidden = t !== track;
      nameEl.textContent = name;
      if (bodies.has(track)) head.setAttribute('aria-controls', bodies.get(track).id);
    },
  };
}
