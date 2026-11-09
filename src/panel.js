// =========================================================================================
// El panel del sinte: presets y todos los controles, por secciones
// =========================================================================================
//
// Un bloque del color de la tinta, como el pie, con la letra del color de la página.
// Plegable con su cabecera; abierto de entrada solo en escritorio. Los deslizadores que
// abarcan mucho (tiempos, frecuencias) van en escala logarítmica: la mitad del recorrido
// es la media geométrica, no la aritmética.

import { PRESETS, JITTER } from './synth.js';

const hz = (v) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 1 : 2)}k` : `${Math.round(v)}`);
const sec = (v) => (v < 1 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(v < 10 ? 2 : 1)}s`);
const pct = (v) => `${Math.round(v * 100)}%`;

// Las secciones y sus controles. «choice»: botones, uno elegido; si no, un deslizador.
const SECTIONS = [
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
    rows: [{ key: 'volume', label: 'volume', min: -40, max: 0, step: 0.5, format: (v) => `${v.toFixed(1)}db` }],
  },
];

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

export function createPanel(root, synth) {
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  // La cabecera: el nombre y plegar/desplegar.
  const head = el('button', 'synth__head');
  head.type = 'button';
  head.innerHTML = '<span>synth</span><span class="synth__fold" aria-hidden="true"></span>';
  const body = el('div', 'synth__body');
  body.id = 'synth-body';
  head.setAttribute('aria-controls', body.id);
  root.append(head, body);

  const setOpen = (open) => {
    root.classList.toggle('is-open', open);
    head.setAttribute('aria-expanded', String(open));
  };
  head.addEventListener('click', () => setOpen(!root.classList.contains('is-open')));
  setOpen(matchMedia('(min-width: 64rem) and (pointer: fine)').matches);

  // Para volver a pintar todos los controles (al cambiar de preset).
  const refreshers = [];
  let preset = 'init';

  // Los presets.
  const presets = el('div', 'synth__section');
  presets.append(el('h2', 'synth__title', 'preset'));
  const presetRow = el('div', 'synth__choice');
  for (const name of Object.keys(PRESETS)) {
    const b = el('button', null, name);
    b.type = 'button';
    b.addEventListener('click', () => {
      preset = name;
      synth.preset(name);
      refreshers.forEach((f) => f());
    });
    refreshers.push(() => b.classList.toggle('is-on', preset === name));
    presetRow.append(b);
  }
  presets.append(presetRow);

  // Random: una variación del preset elegido (synth.js, JITTER), dentro de los límites de
  // cada deslizador. También con la R del teclado.
  const limits = Object.fromEntries(SECTIONS.flatMap((s) => s.rows).filter((r) => !r.choice).map((r) => [r.key, r]));
  const randomize = () => {
    const base = synth.defaults(preset);
    const spread = (amount) => (Math.random() * 2 - 1) * amount;
    for (const [key, { mul, add, step }] of Object.entries(JITTER)) {
      const from = base[key];
      if (!from) {
        synth.set(key, from);
        continue;
      }
      let v = mul ? from * 2 ** spread(mul) : from + spread(add);
      const { min, max, step: rowStep } = limits[key];
      const by = step || rowStep;
      if (by) v = Math.round(v / by) * by;
      synth.set(key, Math.max(min, Math.min(max, v)));
    }
    refreshers.forEach((f) => f());
  };
  const random = el('button', 'synth__random', 'random');
  random.type = 'button';
  random.setAttribute('aria-label', 'Una variación al azar del preset (tecla R)');
  random.addEventListener('click', randomize);
  presets.append(random);
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyR' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select')) return;
    randomize();
  });
  body.append(presets);

  for (const section of SECTIONS) {
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
            synth.set(row.key, value);
            refreshers.forEach((f) => f());
          });
          refreshers.push(() => {
            const on = synth.params[row.key] === value;
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
        synth.set(row.key, v);
        out.textContent = row.format(v);
      });
      // Doble clic: vuelve al valor del preset.
      input.addEventListener('dblclick', () => {
        synth.set(row.key, { ...synth.defaults(preset) }[row.key]);
        refreshers.forEach((f) => f());
      });
      refreshers.push(() => {
        input.value = toSlider(row, synth.params[row.key]);
        out.textContent = row.format(synth.params[row.key]);
      });
      line.append(name, input, out);
      box.append(line);
    }
    body.append(box);
  }

  refreshers.forEach((f) => f());
}
